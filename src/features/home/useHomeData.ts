import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays, format, startOfDay } from "date-fns";
import { db } from "../../db/database";
import { staleWallets } from "../../domain/reconciliation";
import { computeBalances } from "../../domain/balance";
import { backupReminder } from "../../domain/backup";
import { budgetStates } from "../../domain/budget";
import { cycleOverview } from "../../domain/cycle";
import { periodFor } from "../../domain/period";
import { dailyExpenses } from "../../domain/home-series";
import { upTo } from "../../domain/cutoff";
import type { CurrencyCode } from "../../lib/money";
import { usePeriodSettings } from "../stats/period-state";
import { useBalanceCutoff } from "../settings/balance-cutoff";

const EMPTY: never[] = [];
const EMPTY_DEBTS: never[] = [];
const EMPTY_PAYMENTS: never[] = [];
const EMPTY_RECONCILIATIONS: never[] = [];
const PREVIEW = 2;

/** Les N derniers jours (AAAA-MM-JJ), du plus ancien au plus récent. */
function lastDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) =>
    format(addDays(today, i - count + 1), "yyyy-MM-dd"),
  );
}

/**
 * Jour local courant (AAAA-MM-JJ), mis à jour à minuit et au retour de l'app au premier plan.
 * Une seule minuterie, jusqu'au prochain minuit : rien ne tourne en continu.
 */
function useLocalDay(): string {
  const [day, setDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  useEffect(() => {
    const refresh = () => setDay(format(new Date(), "yyyy-MM-dd"));
    const nextMidnight = startOfDay(addDays(new Date(), 1)).getTime();
    // Une seconde de marge : une minuterie peut partir quelques millisecondes en avance.
    const timer = window.setTimeout(refresh, Math.max(1000, nextMidnight - Date.now() + 1000));
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [day]);
  return day;
}

/**
 * Données de l'accueil : requêtes live et valeurs dérivées (calculs dans domain/).
 * `loaded` reste faux tant que les tables principales n'ont pas répondu : un tableau vide
 * pendant le chargement ne veut pas dire « aucune donnée ».
 */
export function useHomeData() {
  const ratesQ = useLiveQuery(() => db.exchangeRates.toArray(), []);
  const walletsQ = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []);
  const reconciliationsQ = useLiveQuery(() => db.reconciliations.toArray(), []);
  const transactionsQ = useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []);
  const categoriesQ = useLiveQuery(() => db.categories.toArray(), []);
  const recurringQ = useLiveQuery(() => db.recurring.toArray(), []);
  const settingsQ = useLiveQuery(() => db.settings.toArray(), []);
  const pendingCountQ = useLiveQuery(() => db.transactions.where("status").equals("pending").count(), []);
  const budgetsQ = useLiveQuery(() => db.budgets.toArray(), []);
  const debtsQ = useLiveQuery(() => db.debts.toArray(), []);
  const debtPaymentsQ = useLiveQuery(() => db.debtPayments.toArray(), []);

  const loaded =
    walletsQ !== undefined &&
    transactionsQ !== undefined &&
    categoriesQ !== undefined &&
    settingsQ !== undefined;

  const rates = ratesQ ?? EMPTY;
  const wallets = walletsQ ?? EMPTY;
  const reconciliations = reconciliationsQ ?? EMPTY_RECONCILIATIONS;
  const transactions = transactionsQ ?? EMPTY;
  const categories = categoriesQ ?? EMPTY;
  const recurring = recurringQ ?? EMPTY;
  const settings = settingsQ?.[0];
  const baseCurrency: CurrencyCode = settings?.baseCurrency ?? "MGA";
  const pendingCount = pendingCountQ ?? 0;
  const lastBackupAt = settings?.lastBackupAt;
  const budgets = budgetsQ ?? EMPTY;
  const debts = debtsQ ?? EMPTY_DEBTS;
  const debtPayments = debtPaymentsQ ?? EMPTY_PAYMENTS;
  const payCategoryId = settings?.payIncomeCategoryId;
  const payMode = settings?.payMode;

  const firstDataAt = transactions.length > 0 ? transactions[transactions.length - 1]?.date : undefined;
  const backupState = backupReminder(lastBackupAt, new Date(), transactions.length > 0, firstDataAt);
  const active = useMemo(() => wallets.filter((w) => !w.archived), [wallets]);
  const cutoff = useBalanceCutoff();
  const balances = useMemo(
    () => computeBalances(active, transactions, cutoff),
    [active, transactions, cutoff],
  );
  const periodSettings = usePeriodSettings();
  const budgetRows = useMemo(() => {
    const now = new Date();
    const states = budgetStates(
      budgets.filter((b) => !b.archived),
      upTo(transactions, cutoff),
      now,
      periodSettings,
    );
    return budgets
      .filter((b) => !b.archived)
      .flatMap((budget) => {
        const state = states.get(budget.id);
        return state ? [{ budget, state }] : [];
      });
  }, [budgets, transactions, periodSettings, cutoff]);

  // Irregular ou sans paie : la question est réglée, la carte ne la repose plus.
  const payAnswered = payMode === "irregular" || payMode === "none";
  // « Maintenant » est recalculé à chaque changement des données et à chaque changement de jour
  // (minuit, retour au premier plan) : le cycle ne reste pas figé si l'app reste ouverte.
  const today = useLocalDay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cycleNow = useMemo(() => new Date(), [transactions, today]);
  const { monthStartDay, payOnFriday } = periodSettings;
  const cycleView = useMemo(() => {
    const period = periodFor("month", cycleNow, { monthStartDay, weekStartDay: 1, payOnFriday });
    return cycleOverview({
      wallets,
      transactions,
      recurring,
      debts,
      debtPayments,
      rates,
      baseCurrency,
      period,
      now: cycleNow,
      payCategoryId,
    });
  }, [
    wallets,
    transactions,
    recurring,
    debts,
    debtPayments,
    rates,
    baseCurrency,
    cycleNow,
    monthStartDay,
    payOnFriday,
    payCategoryId,
  ]);

  const incomeCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === "income" && !c.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  // Échéances : récurrences actives, de la plus proche à la plus lointaine.
  const upcoming = useMemo(
    () =>
      recurring
        .filter((r) => !r.archived && !r.paused)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
        .slice(0, 6),
    [recurring],
  );

  // Dépenses sur 7 jours (même règle que les dépenses affichées, voir domain/home-series).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days7 = useMemo(() => lastDays(30).slice(-7), [today]);
  const expenseMinor = useMemo(
    () => dailyExpenses(upTo(transactions, cutoff), days7, baseCurrency),
    [transactions, days7, baseCurrency, cutoff],
  );
  const weekExpenses = days7.map((day, i) => ({ day, value: (expenseMinor[i] ?? 0) / 100 }));
  const weekTotalMinor = expenseMinor.reduce((sum, v) => sum + v, 0);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletName = (id: string | undefined) => active.find((w) => w.id === id)?.name ?? "";
  const recent = transactions.filter((tx) => tx.currency === baseCurrency).slice(0, PREVIEW);
  const stale = staleWallets(active, transactions, reconciliations, cycleNow);

  return {
    loaded,
    baseCurrency,
    transactions,
    categories,
    categoryById,
    incomeCategories,
    active,
    balances,
    walletName,
    budgetRows,
    cycleView,
    payAnswered,
    monthStartDay,
    upcoming,
    weekExpenses,
    weekTotalMinor,
    recent,
    stale,
    backupState,
    pendingCount,
  };
}

export type HomeData = ReturnType<typeof useHomeData>;
