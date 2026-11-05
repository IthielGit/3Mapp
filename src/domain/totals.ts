import type { Transaction } from "../db/entities";
import { sumMinor, type Minor } from "../lib/money";

/**
 * Vrai si la transaction compte comme dépense : une dépense, ou une réconciliation qui retire de l'argent
 * (ajustement négatif). Pas un versement d’objectif ni un remboursement de dette.
 */
export function isSpending(
  t: Pick<Transaction, "type" | "amount" | "goalId" | "debtId" | "undetailed">,
): boolean {
  const outflow = t.type === "expense" || (t.type === "adjustment" && t.amount < 0);
  return outflow && t.goalId === undefined && t.debtId === undefined && !t.undetailed;
}

/**
 * Vrai si la transaction compte comme revenu : un revenu, ou une réconciliation qui ajoute de l'argent
 * (ajustement positif). Pas un retrait d’objectif ni un remboursement reçu.
 */
export function isEarning(
  t: Pick<Transaction, "type" | "amount" | "goalId" | "debtId" | "undetailed">,
): boolean {
  const inflow = t.type === "income" || (t.type === "adjustment" && t.amount > 0);
  return inflow && t.goalId === undefined && t.debtId === undefined && !t.undetailed;
}

/**
 * Montant compté d'une transaction revenu ou dépense, toujours positif : un ajustement négatif
 * est compté en dépense pour son montant absolu.
 */
export function countedAmount(t: Pick<Transaction, "amount">): Minor {
  return Math.abs(t.amount);
}

export interface Totals {
  income: Minor;
  expense: Minor;
  /** Revenus − dépenses (réconciliations comprises) : variation réelle du solde hors virements. */
  net: Minor;
}

/**
 * Totaux revenus / dépenses (SPEC §6, règles 2 et 3).
 * Les virements n'entrent jamais dans ces totaux (ils restent entre deux portefeuilles).
 * Les réconciliations comptent comme revenu (ajustement positif) ou dépense (ajustement négatif).
 * Seules les transactions `posted` comptent.
 */
export function totals(transactions: readonly Transaction[]): Totals {
  const incomes: Minor[] = [];
  const expenses: Minor[] = [];
  for (const t of transactions) {
    if (t.status !== "posted") continue;
    if (isEarning(t)) incomes.push(countedAmount(t));
    if (isSpending(t)) expenses.push(countedAmount(t));
  }
  const income = sumMinor(incomes);
  const expense = sumMinor(expenses);
  return { income, expense, net: income - expense };
}
