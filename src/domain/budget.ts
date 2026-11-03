import type { Budget, Transaction } from "../db/entities";
import { sumMinor, type Minor } from "../lib/money";
import { contains, periodFor, type Period, type PeriodSettings } from "./period";

/**
 * Dépenses comptées par un budget dans une période (SPEC §6, règle 4) :
 * dépenses `posted`, dans la devise du budget, des catégories choisies (et des portefeuilles, s'ils sont précisés).
 */
export function spentIn(
  budget: Pick<Budget, "categoryIds" | "walletIds" | "currency">,
  transactions: readonly Transaction[],
  period: Period,
): Minor {
  return sumMinor(
    transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.status === "posted" &&
          t.currency === budget.currency &&
          t.categoryId !== undefined &&
          budget.categoryIds.includes(t.categoryId) &&
          (budget.walletIds.length === 0 || budget.walletIds.includes(t.walletId)) &&
          contains(period, t.date),
      )
      .map((t) => t.amount),
  );
}

/** Toutes les périodes du budget, de sa date de début jusqu'à la période qui contient `until`. */
export function budgetPeriods(
  budget: Pick<Budget, "period" | "startDate" | "endDate">,
  until: Date,
  settings: PeriodSettings,
): Period[] {
  if (budget.period === "custom") {
    const from = new Date(budget.startDate);
    const to = budget.endDate
      ? new Date(new Date(budget.endDate).getTime() + 1)
      : new Date(until.getTime() + 1);
    return [{ from, to }];
  }
  const kind = budget.period;
  const last = periodFor(kind, until, settings);
  const periods: Period[] = [];
  let cursor = periodFor(kind, new Date(budget.startDate), settings);
  for (let guard = 0; guard < 1000; guard++) {
    periods.push(cursor);
    if (cursor.from.getTime() >= last.from.getTime()) break;
    cursor = periodFor(kind, new Date(cursor.to.getTime()), settings);
  }
  return periods;
}

export type BudgetStatus = "ok" | "threshold" | "exceeded";

export interface BudgetState {
  period: Period;
  /** Montant de base de la période. */
  base: Minor;
  /** Report reçu de la période précédente (négatif si un dépassement est reporté). Nul sans report. */
  carry: Minor;
  /** Disponible = base + report. */
  available: Minor;
  spent: Minor;
  remaining: Minor;
  /** Pourcentage consommé, arrondi à l'unité (peut dépasser 100). */
  percent: number;
  status: BudgetStatus;
  /** Montant conseillé par jour pour le reste de la période ; null si la période est finie ou dépassée. */
  dailyAllowance: Minor | null;
}

/**
 * État du budget pour la période courante, avec le report calculé sur toutes les périodes précédentes.
 * Avec report activé, le reste (positif ou négatif) de chaque période est reporté sur la suivante.
 */
export function budgetState(
  budget: Budget,
  transactions: readonly Transaction[],
  now: Date,
  settings: PeriodSettings,
): BudgetState {
  const periods = budgetPeriods(budget, now, settings);
  let carry: Minor = 0;
  let state: BudgetState | undefined;

  periods.forEach((period, index) => {
    const available = sumMinor([budget.amount, carry]);
    const spent = spentIn(budget, transactions, period);
    const remaining = available - spent;
    if (index === periods.length - 1) {
      state = buildState(
        period,
        budget.amount,
        carry,
        available,
        spent,
        remaining,
        budget.alertThreshold,
        now,
      );
    }
    carry = budget.rollover ? remaining : 0;
  });

  if (!state) throw new Error("Budget sans période");
  return state;
}

/** Budgets avec leur état, pour la vue étendue. */
export function budgetStates(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
  now: Date,
  settings: PeriodSettings,
): Map<string, BudgetState> {
  return new Map(budgets.map((b) => [b.id, budgetState(b, transactions, now, settings)]));
}

function buildState(
  period: Period,
  base: Minor,
  carry: Minor,
  available: Minor,
  spent: Minor,
  remaining: Minor,
  threshold: number,
  now: Date,
): BudgetState {
  const percent = available > 0 ? Math.round((spent * 100) / available) : spent > 0 ? 100 : 0;
  let status: BudgetStatus = "ok";
  if (spent > available) status = "exceeded";
  else if (available > 0 && percent >= threshold) status = "threshold";

  const dayMs = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((period.to.getTime() - now.getTime()) / dayMs));
  const dailyAllowance = remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft) : null;

  return { period, base, carry, available, spent, remaining, percent, status, dailyAllowance };
}
