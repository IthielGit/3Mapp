import { Icon } from "../../components/Icon";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { staleWallets } from "../../domain/reconciliation";
import { useTranslation } from "react-i18next";
import { addDays, format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts";
import { db } from "../../db/database";
import { computeBalances } from "../../domain/balance";
import { backupReminder } from "../../domain/backup";
import { budgetStates } from "../../domain/budget";
import { cycleOverview, type PayStatus } from "../../domain/cycle";
import { periodFor } from "../../domain/period";
import { usePeriodSettings } from "../stats/period-state";
import { dailyExpenses } from "../../domain/home-series";
import { TransactionRow, WalletCard } from "../../components/TransactionRow";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { useBalanceCutoff } from "../settings/balance-cutoff";
import { upTo } from "../../domain/cutoff";
import { BrandMark } from "../../components/BrandMark";
import { updatePreferences } from "../settings/preferences-service";
import { PaySetupForm, type PayChoice } from "../cycle/PaySetupForm";

const EMPTY: never[] = [];
const EMPTY_DEBTS: never[] = [];
const EMPTY_PAYMENTS: never[] = [];
const EMPTY_RECONCILIATIONS: never[] = [];
const PREVIEW = 2;

/** Engrenage des réglages (tracé ISC, Lucide), en haut à droite. */
function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Les N derniers jours (AAAA-MM-JJ), du plus ancien au plus récent. */
function lastDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) =>
    format(addDays(today, i - count + 1), "yyyy-MM-dd"),
  );
}

/**
 * Accueil : en-tête (salutation, réglages), échéances à venir en cartes défilantes,
 * vue d'ensemble avec deux mini-graphiques, carte d'action, puis portefeuilles et transactions.
 */
export function HomePage() {
  const { t, i18n } = useTranslation();
  const [suggestionHidden, setSuggestionHidden] = useState(false);
  const rates = useLiveQuery(() => db.exchangeRates.toArray(), []) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []) ?? EMPTY;
  const reconciliations =
    useLiveQuery(() => db.reconciliations.toArray(), []) ?? EMPTY_RECONCILIATIONS;
  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const recurring = useLiveQuery(() => db.recurring.toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";
  const pendingCount =
    useLiveQuery(() => db.transactions.where("status").equals("pending").count(), []) ?? 0;
  const lastBackupAt = useLiveQuery(
    async () => (await db.settings.toCollection().first())?.lastBackupAt,
    [],
  );

  const firstDataAt = transactions.length > 0 ? transactions[transactions.length - 1]?.date : undefined;
  const backupState = backupReminder(lastBackupAt, new Date(), transactions.length > 0, firstDataAt);
  const active = wallets.filter((w) => !w.archived);
  const cutoff = useBalanceCutoff();
  const balances = useMemo(
    () => computeBalances(active, transactions, cutoff),
    [active, transactions, cutoff],
  );
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? EMPTY;
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

  // Mon cycle : du jour de début du mois comptable au suivant, constat sur les transactions validées.
  const debts = useLiveQuery(() => db.debts.toArray(), []) ?? EMPTY_DEBTS;
  const debtPayments = useLiveQuery(() => db.debtPayments.toArray(), []) ?? EMPTY_PAYMENTS;
  const payCategoryId = useLiveQuery(
    async () => (await db.settings.toArray())[0]?.payIncomeCategoryId,
    [],
  );
  const payMode = useLiveQuery(async () => (await db.settings.toArray())[0]?.payMode, []);
  // Irregular ou sans paie : la question est réglée, la carte ne la repose plus.
  const payAnswered = payMode === "irregular" || payMode === "none";
  // « Maintenant » est recalculé à chaque changement des données, pour que la carte reste à jour.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cycleNow = useMemo(() => new Date(), [transactions]);
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
  const cycle = cycleView.summary;
  // Les comptes comptés dans « Disponible » sont nommés, pour que l'utilisateur sache ce qui est inclus.
  const countedList = active
    .filter((w) => w.includeInTotal && w.group !== "savings")
    .map((w) => w.name);
  const countedNames = countedList.join(", ");
  const cycleLocale = i18n.language.startsWith("en") ? enUS : fr;
  const cycleLastDay = new Date(cycle.period.to.getTime() - 1);
  const noStartBalance =
    cycle.available < 0 &&
    active.filter((w) => w.includeInTotal && w.group !== "savings").every((w) => w.initialBalance === 0);
  // La question de paie vit sur la carte colorée : texte blanc, boutons blanc et contour.
  function payLine(pay: PayStatus) {
    const day = (d: Date) => format(d, "d MMM", { locale: cycleLocale });
    switch (pay.kind) {
      case "unset": {
        const suggestion = cycleView.suggestedPay;
        if (suggestion && !suggestionHidden) {
          const category = categories.find((c) => c.id === suggestion.categoryId)?.name ?? "";
          return (
            <div className="flex flex-col gap-3">
              <p>
                {t("cycle.lastEntry", {
                  amount: formatMoney(suggestion.amount, baseCurrency),
                  date: day(suggestion.date),
                  category,
                })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl bg-white font-semibold text-brand-900"
                  onClick={() => void acceptSuggestedPay(suggestion.categoryId)}
                >
                  {t("cycle.yes")}
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl border border-white/40 font-medium text-white"
                  onClick={() => setSuggestionHidden(true)}
                >
                  {t("cycle.no")}
                </button>
              </div>
            </div>
          );
        }
        return (
          <Link to="/plus" className="inline-flex min-h-[44px] items-center underline">
            {t("cycle.paySet")}
          </Link>
        );
      }
      case "received":
        return (
          <p>
            {t("cycle.payReceived", {
              amount: formatMoney(pay.amount, baseCurrency),
              date: day(pay.date),
            })}
          </p>
        );
      case "expected":
        return (
          <p>
            {t("cycle.payExpected", { date: day(pay.date) })} ·{" "}
            <Link to="/transactions/new" className="underline">
              {t("cycle.addPay")}
            </Link>
          </p>
        );
      case "late":
        return (
          <p>
            {t("cycle.payLate", { days: pay.daysLate })} ·{" "}
            <Link to="/transactions/new" className="underline">
              {t("cycle.addPay")}
            </Link>
          </p>
        );
    }
  }

  /** « C'est votre paie ? » : enregistre la catégorie et, si besoin, le jour de paie. */
  async function acceptSuggestedPay(categoryId: string) {
    // Seule la catégorie est enregistrée : le jour de paie reste celui que l’utilisateur a réglé.
    await updatePreferences({ payIncomeCategoryId: categoryId, payMode: "fixed" });
  }

  /** Question de paie sans suggestion : le jour de paie et la catégorie de revenu sont enregistrés ensemble. */
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === "income" && !c.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );
  async function savePaySetup(choice: PayChoice) {
    if (choice.mode === "fixed") {
      await updatePreferences({
        monthStartDay: choice.day,
        payMode: "fixed",
        ...(choice.categoryId ? { payIncomeCategoryId: choice.categoryId } : {}),
      });
      return;
    }
    await updatePreferences({ payMode: choice.mode });
  }

  // Échéances : récurrences actives, de la plus proche à la plus lointaine.
  const upcoming = useMemo(
    () =>
      recurring
        .filter((r) => !r.archived && !r.paused)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
        .slice(0, 6),
    [recurring],
  );

  // Vue d'ensemble : dépenses sur 7 jours (même règle que les dépenses affichées, voir domain/home-series).
  const days7 = useMemo(() => lastDays(30).slice(-7), []);
  const expenseMinor = useMemo(
    () => dailyExpenses(upTo(transactions, cutoff), days7, baseCurrency),
    [transactions, days7, baseCurrency, cutoff],
  );
  const weekExpenses = days7.map((day, i) => ({ day, value: (expenseMinor[i] ?? 0) / 100 }));
  const weekTotalMinor = expenseMinor.reduce((sum, v) => sum + v, 0);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const walletName = (id: string | undefined) => active.find((w) => w.id === id)?.name ?? "";
  const recent = transactions.filter((tx) => tx.currency === baseCurrency).slice(0, PREVIEW);
  const stale = staleWallets(active, transactions, reconciliations, cycleNow);

  return (
    <section className="-mx-4 flex flex-col gap-5 px-4">
      <h1 className="sr-only">{t("nav.home")}</h1>

      {/* En-tête : « Bienvenue », le mois en cours, et l'engrenage seul. */}
      <header className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between bg-canvas px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-page">
        <div className="flex items-center gap-3">
          <BrandMark size={44} className="shrink-0 rounded-xl shadow-sm" />
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tracking-tight text-ink dark:text-fg">{t("home.hello")}</span>
            <span className="text-sm capitalize text-neutral-600 dark:text-muted">
              {format(cycleNow, "MMMM yyyy", { locale: cycleLocale })}
            </span>
          </div>
        </div>
        <Link
          to="/plus"
          aria-label={t("nav.more")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
        >
          <GearIcon />
        </Link>
      </header>

      {/* Saisie en retard : un portefeuille sans mouvement ni réconciliation depuis trop longtemps. */}
      {stale.length > 0 ? (
        <Link
          to={`/plus/wallets/${stale[0]?.wallet.id ?? ""}/reconcile`}
          className="pressable flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink dark:border-amber-700 dark:bg-raised dark:text-fg"
        >
          <span>
            {t("home.staleWallet", {
              name: stale[0]?.wallet.name ?? "",
              days: stale[0]?.daysSince ?? 0,
            })}
          </span>
          <span className="shrink-0 font-semibold underline">{t("home.staleAction")}</span>
        </Link>
      ) : null}

      {/* Votre mois : la seule carte colorée. Elle répond d'abord à « combien puis-je dépenser ? ». */}
      <section
        aria-labelledby="cycle-title"
        className="relative flex flex-col gap-3 overflow-hidden rounded-3xl p-5 text-white shadow-lg"
        style={{ background: "linear-gradient(150deg, #0B7E9D 0%, #075064 100%)" }}
      >
        <h2 id="cycle-title" className="text-xs font-medium text-teal-50">
          {t("cycle.title", {
            from: format(cycle.period.from, "d MMM", { locale: cycleLocale }),
            to: format(cycleLastDay, "d MMM", { locale: cycleLocale }),
          })}
        </h2>

        {noStartBalance ? (
          // Sans solde de départ, un découvert n'a pas de sens : on demande le solde au lieu d'un montant négatif.
          <div className="flex flex-col gap-3">
            <p className="text-base font-semibold">{t("cycle.noStartBalance")}</p>
            <Link
              to="/plus/wallets"
              className="inline-flex min-h-[44px] items-center self-start rounded-xl bg-white px-4 font-semibold text-brand-900"
            >
              {t("cycle.setStartBalances")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-teal-50">{t("cycle.available")}</p>
            <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums" data-amount>
              {formatMoney(cycle.available, baseCurrency)}
            </p>
            {cycle.available < 0 ? (
              <p className="pt-1 text-sm">
                {t("cycle.negativeBalance")}{" "}
                <Link to="/plus/wallets" className="inline-flex min-h-[44px] items-center underline">
                  {t("cycle.checkAccounts")}
                </Link>
              </p>
            ) : null}
          </div>
        )}

        {/* Phrase du jour, ou dépassement, puis l'épargne du mois. */}
        <div className="flex flex-col gap-2 border-t border-white/20 pt-3">
          {transactions.length === 0 ? (
            <p className="text-sm text-teal-50">{t("cycle.empty")}</p>
          ) : null}
          <p className="text-sm text-teal-50">
            {cycle.saved >= 0
              ? t("cycle.saved", { amount: formatMoney(cycle.saved, baseCurrency) })
              : t("cycle.spentMore", { amount: formatMoney(-cycle.saved, baseCurrency) })}
          </p>
        </div>

        {/* La question de paie, en une ligne sur la carte. */}
        {cycleView.pay.kind === "unset" && payAnswered ? null : cycleView.pay.kind === "unset" &&
          !(cycleView.suggestedPay && !suggestionHidden) ? (
          <PaySetupForm
            tone="hero"
            monthStartDay={monthStartDay}
            categories={incomeCategories}
            submitLabel={t("cycle.paySetupSave")}
            onSave={savePaySetup}
          />
        ) : (
          <div className="rounded-2xl bg-white/15 p-3 text-sm">{payLine(cycleView.pay)}</div>
        )}

        {/* Détail replié : comptes pris en compte, entrées, sorties et versements. */}
        <details className="group flex flex-col gap-3 border-t border-white/20 pt-3">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-xs font-medium text-teal-50 [&::-webkit-details-marker]:hidden">
            {t("cycle.thisMonth")}
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform duration-200 ease-out-strong group-open:rotate-180 motion-reduce:transition-none"
            >
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <p className="text-xs text-teal-50">
            {countedList.length <= 2
              ? t("cycle.accounts", { names: countedNames || "—" })
              : t("cycle.accountsCount", { count: countedList.length })}{" "}
            <Link to="/plus/wallets" className="inline-flex min-h-[44px] items-center underline">
              {t("cycle.editAccounts")}
            </Link>
          </p>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-teal-50">{t("cycle.income")}</dt>
              <dd className="text-sm font-semibold tabular-nums text-emerald-200" data-amount>
                {formatMoney(cycle.income, baseCurrency)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-teal-50">{t("cycle.expense")}</dt>
              <dd className="text-sm font-semibold tabular-nums text-rose-200" data-amount>
                {formatMoney(cycle.expense, baseCurrency)}
              </dd>
            </div>
          </dl>
          {cycle.savedToGoals > 0 ? (
            <p className="text-sm">{t("cycle.savedToGoals", { amount: formatMoney(cycle.savedToGoals, baseCurrency) })}</p>
          ) : null}
          {cycle.debtsPaid > 0 ? (
            <p className="text-sm">{t("cycle.debtsPaid", { amount: formatMoney(cycle.debtsPaid, baseCurrency) })}</p>
          ) : null}
          {cycleView.plannedSaving !== undefined ? (
            <p className="text-xs text-teal-50">
              {t("cycle.plannedSaving", { amount: formatMoney(cycleView.plannedSaving, baseCurrency) })}
            </p>
          ) : null}
        </details>
      </section>

      {/* Alertes : fines, sous la carte, sans couleur d'avertissement. */}
      {backupState !== "none" ? (
        <Link
          to="/plus/backup"
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 border-l-[3px] border-l-brand-600 bg-white p-3 text-sm text-ink shadow-sm dark:border-white/15 dark:bg-card dark:text-fg"
        >
          {t("home.backupReminder")}
        </Link>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          to="/plus/recurring"
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 border-l-[3px] border-l-brand-600 bg-white p-3 text-sm text-ink shadow-sm dark:border-white/15 dark:bg-card dark:text-fg"
        >
          {t("home.pendingBanner", { count: pendingCount })}
        </Link>
      ) : null}

      {/* Cette semaine : les dépenses des 7 derniers jours, et la prochaine échéance en une ligne. */}
      <section aria-labelledby="week-title" className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-card">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="week-title" className="font-semibold text-ink dark:text-fg">
            {t("home.expenseCard")}
          </h2>
          <span className="text-sm font-medium tabular-nums text-ink dark:text-fg" data-amount>
            {formatMoney(weekTotalMinor, baseCurrency)}
          </span>
        </div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekExpenses}>
              <Bar dataKey="value" radius={[8, 8, 4, 4]} isAnimationActive={false}>
                {weekExpenses.map((entry, i) => (
                  <Cell key={entry.day} fill={i === weekExpenses.length - 1 ? "#0B7E9D" : "#4a9d91"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Comptes : tous les comptes pris en compte, avec leur solde. */}
      {active.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.wallets")}</h2>
            <Link
              to="/plus/wallets"
              className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
            >
              {t("home.manage")}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {active.map((w) => (
              <li key={w.id} className="min-w-0">
                <WalletCard wallet={w} balance={balances[w.id] ?? w.initialBalance} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Échéances à venir : les trois prochaines récurrences. */}
      {upcoming.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.upcoming")}</h2>
            <Link
              to="/plus/recurring"
              className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
            >
              {t("home.seeAll")}
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-3xl bg-white px-4 shadow-sm dark:divide-white/10 dark:bg-card">
            {upcoming.slice(0, 3).map((r) => {
              const due = new Date(r.nextDate);
              const income = r.type === "income";
              return (
                <li key={r.id}>
                  <Link to={`/plus/recurring/${r.id}`} className="pressable flex min-h-[64px] items-center gap-3 py-3">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-center leading-none dark:bg-raised">
                      <span className="text-base font-semibold tabular-nums text-ink dark:text-fg">{format(due, "d")}</span>
                      <span className="mt-0.5 text-[10px] uppercase text-neutral-600 dark:text-muted">{format(due, "MMM")}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-ink dark:text-fg">
                        {r.memo || t(`transactions.types.${r.type}`)}
                      </span>
                      <span className="truncate text-xs text-neutral-600 dark:text-muted">{walletName(r.walletId)}</span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${income ? "text-income dark:text-income-dark" : "text-expense dark:text-expense-dark"}`}
                      data-amount
                    >
                      {income ? "+" : "−"}
                      {formatMoney(r.amount, r.currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Budgets : les trois premiers, avec ce qui est dépensé et ce qui reste. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.budgetsTitle")}</h2>
          <Link
            to="/budgets"
            className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
          >
            {t("home.manage")}
          </Link>
        </div>
        {budgetRows.length === 0 ? (
          <Link
            to="/budgets/new"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 underline dark:text-brand-dark"
          >
            {t("home.budgetsEmpty")}
          </Link>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-3xl bg-white px-4 shadow-sm dark:divide-white/10 dark:bg-card">
            {budgetRows.slice(0, 3).map(({ budget, state }) => {
              const width = Math.min(100, Math.max(0, state.percent));
              const barColor =
                state.status === "exceeded"
                  ? "bg-expense dark:bg-expense-dark"
                  : state.status === "threshold"
                    ? "bg-amber-500"
                    : "bg-brand-600 dark:bg-brand-dark";
              return (
                <li key={budget.id} className="py-4">
                  <Link to={`/budgets/${budget.id}`} className="pressable flex min-h-[44px] flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink dark:text-fg">{budget.name}</span>
                      <span className="shrink-0 tabular-nums text-neutral-600 dark:text-muted" data-amount>
                        {formatMoney(state.spent, budget.currency)} / {formatMoney(state.available, budget.currency)}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, state.percent)}
                      aria-label={budget.name}
                      className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-raised"
                    >
                      <div className={`progress-fill h-full rounded-full ${barColor}`} style={{ transform: `scaleX(${width / 100})` }} />
                    </div>
                    {state.status === "exceeded" ? (
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">
                        {t("budgets.exceededBy", { amount: formatMoney(-state.remaining, budget.currency) })}
                      </p>
                    ) : state.status === "threshold" ? (
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        {t("budgets.remaining", { amount: formatMoney(state.remaining, budget.currency) })}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.recent")}</h2>
          <Link
            to="/transactions"
            className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
          >
            {t("home.seeAll")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-500 p-4 text-center text-sm text-neutral-600 dark:border-white/15 dark:text-muted">
            <Icon name="inbox" className="h-6 w-6 text-teal-600 dark:text-teal-300" />
            <span>{t("home.noTransactions")}</span>
          </div>
        ) : (
          <ul className="flex flex-col">
            {recent.map((tx) => (
              <li key={tx.id}>
                <TransactionRow
                  transaction={tx}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                  walletName={walletName}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

