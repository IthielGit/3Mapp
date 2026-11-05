import type {
  Debt,
  DebtPayment,
  ExchangeRate,
  Recurring,
  Transaction,
  Wallet,
} from "../db/entities";
import { type CurrencyCode, type Minor } from "../lib/money";
import { computeBalances } from "./balance";
import { debtState } from "./debts";
import { convertedSum } from "./fx";
import { contains, type Period } from "./period";
import { upcomingOccurrences } from "./recurrence";
import { upTo } from "./cutoff";
import { isEarning, isSpending } from "./totals";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Une paie reçu jusqu'à 5 jours avant le jour de paie compte pour le cycle qu'elle finance. */
const EARLY_DAYS = 5;
/** Au-delà de 3 jours après le jour de paie sans paie reçue, on le signale comme en retard. */
const LATE_DAYS = 3;

export interface CycleSummary {
  period: Period;
  /** Revenus validés dans le cycle. */
  income: Minor;
  /** Dépenses validées dans le cycle. */
  expense: Minor;
  /** Versé aux objectifs dans le cycle (sorties marquées objectif). */
  savedToGoals: Minor;
  /** Dettes et prêts payés ou accordés dans le cycle (sorties marquées dette). */
  debtsPaid: Minor;
  /** Reste du mois : revenus − dépenses − versements aux objectifs − dettes payées (constat, pas une prévision). */
  saved: Minor;
  /** Disponible aujourd'hui : soldes des portefeuilles comptés (hors épargne), en devise de base. */
  available: Minor;
  /** Jours restants avant le début du cycle suivant (au moins 1). */
  daysLeft: number;
}

/**
 * Carte « Mon cycle » : ce qui est entré, sorti et mis de côté dans le cycle, et le disponible.
 * `transactions` doit déjà être dans la devise de base et coupée à la date de référence.
 */
export function cycleSummary(
  transactions: readonly Transaction[],
  period: Period,
  now: Date,
  available: Minor,
): CycleSummary {
  const inCycle = transactions.filter((t) => t.status === "posted" && contains(period, t.date));
  const income = sumOf(inCycle.filter(isEarning));
  const expense = sumOf(inCycle.filter(isSpending));
  const savedToGoals = sumOf(inCycle.filter((t) => t.type === "expense" && t.goalId !== undefined));
  const debtsPaid = sumOf(inCycle.filter((t) => t.type === "expense" && t.debtId !== undefined));
  const daysLeft = Math.max(1, Math.ceil((period.to.getTime() - now.getTime()) / DAY_MS));
  // Reste du mois : revenus moins dépenses, moins ce qui a été versé aux objectifs et aux dettes.
  const saved = income - expense - savedToGoals - debtsPaid;
  return { period, income, expense, savedToGoals, debtsPaid, saved, available, daysLeft };
}

function sumOf(list: readonly { amount: Minor }[]): Minor {
  return list.reduce((sum, t) => sum + t.amount, 0);
}

export interface RestInput {
  /** Disponible aujourd'hui (soldes comptés). */
  available: Minor;
  /** Dépenses saisies mais pas encore validées (elles ne sont pas dans le solde). */
  pendingExpenses: Minor;
  /** Récurrences de dépense pas encore générées, avant la prochaine paie. */
  upcomingExpenses: Minor;
  /** Dettes empruntées à rembourser avant la prochaine paie, ou en retard. */
  debtsDue: Minor;
  /** Jours restants jusqu'à la prochaine paie. */
  daysLeft: number;
}

export interface RestResult {
  /** Reste à vivre ; négatif si les engagements dépassent le disponible. */
  rest: Minor;
  /** Montant par jour pour tenir jusqu'à la paie ; 0 si le reste est négatif. */
  perDay: Minor;
  overdrawn: boolean;
}

/** Reste à vivre jusqu'à la prochaine paie : disponible moins tout ce qui est déjà engagé. Fonction pure. */
export function restAVivre(input: RestInput): RestResult {
  const rest = input.available - input.pendingExpenses - input.upcomingExpenses - input.debtsDue;
  const perDay = rest > 0 ? Math.floor(rest / Math.max(1, input.daysLeft)) : 0;
  return { rest, perDay, overdrawn: rest < 0 };
}

export type PayStatus =
  | { kind: "unset" }
  | { kind: "received"; amount: Minor; date: Date }
  | { kind: "expected"; date: Date }
  | { kind: "late"; date: Date; daysLate: number };

/**
 * Statut de la paie du cycle. Une paie est rattachée au cycle qu'elle finance : une paie reçue
 * jusqu'à 5 jours avant le début du cycle compte pour ce cycle. Seules les paies validées comptent.
 */
export function payStatus(
  transactions: readonly Transaction[],
  payCategoryId: string | undefined,
  period: Period,
  now: Date,
): PayStatus {
  if (!payCategoryId) return { kind: "unset" };
  const windowStart = addDays(period.from, -EARLY_DAYS);
  const windowEnd = addDays(period.to, -EARLY_DAYS);
  // Pas de « en retard » sans historique : il faut avoir déjà reçu une paie avant ce cycle.
  const hasHistory = transactions.some(
    (t) =>
      t.type === "income" &&
      t.status === "posted" &&
      t.categoryId === payCategoryId &&
      new Date(t.date).getTime() < windowStart.getTime(),
  );
  const pays = transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.status === "posted" &&
        t.categoryId === payCategoryId &&
        new Date(t.date).getTime() >= windowStart.getTime() &&
        new Date(t.date).getTime() < windowEnd.getTime(),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = pays[0];
  if (first) {
    return { kind: "received", amount: sumOf(pays), date: new Date(first.date) };
  }
  const daysSincePay = Math.floor((now.getTime() - period.from.getTime()) / DAY_MS);
  if (daysSincePay < LATE_DAYS || !hasHistory) return { kind: "expected", date: period.from };
  return { kind: "late", date: period.from, daysLate: daysSincePay };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours());
}

export interface CycleOverview {
  summary: CycleSummary;
  rest: RestResult;
  pendingExpenses: Minor;
  upcomingExpenses: Minor;
  debtsDue: Minor;
  pay: PayStatus;
  /** Dernière entrée de revenu, proposée comme paie quand aucun revenu de paie n'est choisi. */
  suggestedPay?: { categoryId: string; amount: Minor; date: Date } | undefined;
  /**
   * Épargne prévue : paie du cycle (reçue, sinon la dernière paie connue) moins toutes les dépenses
   * connues. Absente tant qu'aucune paie n'est connue.
   */
  plannedSaving?: Minor;
}

/**
 * Dernière entrée de revenu validée, avec sa catégorie. Seules les catégories qui reviennent
 * (entrées dans au moins deux mois différents) sont proposées : pas de remboursement isolé.
 */
function latestIncome(
  transactions: readonly Transaction[],
  now: Date,
): { categoryId: string; amount: Minor; date: Date } | undefined {
  const known = transactions.filter(
    (t) =>
      t.type === "income" &&
      t.status === "posted" &&
      t.categoryId !== undefined &&
      new Date(t.date).getTime() <= now.getTime(),
  );
  const monthsByCategory = new Map<string, Set<string>>();
  for (const t of known) {
    const months = monthsByCategory.get(t.categoryId ?? "") ?? new Set<string>();
    months.add(t.date.slice(0, 7));
    monthsByCategory.set(t.categoryId ?? "", months);
  }
  const last = known
    .filter((t) => (monthsByCategory.get(t.categoryId ?? "")?.size ?? 0) >= 2)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last || last.categoryId === undefined) return undefined;
  return { categoryId: last.categoryId, amount: last.amount, date: new Date(last.date) };
}

/** Montant de la dernière paie validée reçue avant le cycle (sans compter les paies en cours de cycle). */
function lastPayBefore(
  transactions: readonly Transaction[],
  payCategoryId: string,
  from: Date,
): Minor | undefined {
  const windowStart = addDays(from, -EARLY_DAYS).getTime();
  const earlier = transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.status === "posted" &&
        t.categoryId === payCategoryId &&
        new Date(t.date).getTime() < windowStart,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return earlier[0]?.amount;
}

export interface CycleInput {
  wallets: readonly Wallet[];
  transactions: readonly Transaction[];
  recurring: readonly Recurring[];
  debts: readonly Debt[];
  debtPayments: readonly DebtPayment[];
  rates: readonly ExchangeRate[];
  baseCurrency: CurrencyCode;
  period: Period;
  now: Date;
  payCategoryId?: string | undefined;
}

/**
 * Vue « Mon cycle » complète : disponible, reste à vivre et statut de la paie.
 * Les portefeuilles comptés sont ceux qui sont dans le total et qui ne sont pas d'épargne.
 * Les montants sont convertis en devise de base ; un taux manquant ne compte pas (voir fx.ts).
 */
export function cycleOverview(input: CycleInput): CycleOverview {
  const { baseCurrency, rates, now, period } = input;
  const counted = input.wallets.filter(
    (w) => !w.archived && w.includeInTotal && w.group !== "savings",
  );
  const countedIds = new Set(counted.map((w) => w.id));
  const balances = computeBalances(counted, input.transactions, now);
  const available = convertedSum(
    counted.map((w) => ({
      amount: balances[w.id] ?? w.initialBalance,
      currency: w.currency,
      date: now.toISOString(),
    })),
    baseCurrency,
    rates,
  ).total;

  const visible = upTo(input.transactions, now);
  const baseTransactions = visible.filter((t) => t.currency === baseCurrency);
  const summary = cycleSummary(baseTransactions, period, now, available);

  const pendingExpenses = convertedSum(
    input.transactions
      .filter((t) => t.type === "expense" && t.status === "pending" && countedIds.has(t.walletId))
      .map((t) => ({ amount: t.amount, currency: t.currency, date: t.date })),
    baseCurrency,
    rates,
  ).total;

  const upcomingItems = input.recurring
    .filter((r) => !r.archived && !r.paused && r.type === "expense" && countedIds.has(r.walletId))
    .flatMap((r) =>
      upcomingOccurrences(r, period.to).map((date) => ({
        amount: r.amount,
        currency: r.currency,
        date: date.toISOString(),
      })),
    );
  const upcomingExpenses = convertedSum(upcomingItems, baseCurrency, rates).total;

  const debtItems = input.debts
    .filter((d) => d.direction === "borrowed")
    .flatMap((d) => {
      const state = debtState(
        {
          principal: d.principal,
          interestRate: d.interestRate,
          startDate: d.startDate,
          dueDate: d.dueDate,
        },
        input.debtPayments.filter((p) => p.debtId === d.id),
        now,
      );
      const dueBeforePay = d.dueDate !== undefined && new Date(d.dueDate).getTime() < period.to.getTime();
      if (state.remaining === 0) return [];
      if (state.status !== "late" && !dueBeforePay) return [];
      return [{ amount: state.remaining, currency: d.currency, date: now.toISOString() }];
    });
  const debtsDue = convertedSum(debtItems, baseCurrency, rates).total;

  const rest = restAVivre({
    available,
    pendingExpenses,
    upcomingExpenses,
    debtsDue,
    daysLeft: summary.daysLeft,
  });
  const pay = payStatus(baseTransactions, input.payCategoryId, period, now);

  const expectedPay =
    pay.kind === "received"
      ? pay.amount
      : input.payCategoryId
        ? lastPayBefore(baseTransactions, input.payCategoryId, period.from)
        : undefined;
  const plannedSaving =
    expectedPay === undefined
      ? undefined
      : expectedPay -
        summary.expense -
        summary.savedToGoals -
        summary.debtsPaid -
        pendingExpenses -
        upcomingExpenses -
        debtsDue;

  const suggestedPay = input.payCategoryId ? undefined : latestIncome(baseTransactions, now);

  return {
    summary,
    rest,
    pendingExpenses,
    upcomingExpenses,
    debtsDue,
    pay,
    plannedSaving,
    suggestedPay,
  };
}
