import type { Transaction } from "../db/entities";
import { sumMinor, type Minor } from "../lib/money";
import { contains, type Period } from "./period";

export interface CycleSummary {
  period: Period;
  /** Revenus validés dans le cycle. */
  income: Minor;
  /** Dépenses validées dans le cycle. */
  expense: Minor;
  /** Mis de côté : revenus − dépenses du cycle (constat, pas une prévision). */
  saved: Minor;
  /** Disponible aujourd'hui : soldes des portefeuilles courants (hors épargne), en devise de base. */
  available: Minor;
  /** Jours restants avant le début du cycle suivant (au moins 1). */
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Carte « Mon cycle » : ce qui est entré, sorti et mis de côté dans le cycle, et le disponible.
 * `transactions` doit déjà être dans la devise de base et coupée à la date de référence.
 * `available` est calculé par l'appelant (soldes convertis), pour garder cette fonction pure.
 */
export function cycleSummary(
  transactions: readonly Transaction[],
  period: Period,
  now: Date,
  available: Minor,
): CycleSummary {
  const inCycle = transactions.filter((t) => t.status === "posted" && contains(period, t.date));
  const income = sumMinor(inCycle.filter((t) => t.type === "income").map((t) => t.amount));
  const expense = sumMinor(inCycle.filter((t) => t.type === "expense").map((t) => t.amount));
  const daysLeft = Math.max(1, Math.ceil((period.to.getTime() - now.getTime()) / DAY_MS));
  return { period, income, expense, saved: income - expense, available, daysLeft };
}
