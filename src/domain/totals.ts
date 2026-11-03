import type { Transaction } from "../db/entities";
import { sumMinor, type Minor } from "../lib/money";

export interface Totals {
  income: Minor;
  expense: Minor;
  /** Revenus − dépenses. */
  net: Minor;
}

/**
 * Totaux revenus / dépenses (SPEC §6, règles 2 et 3).
 * Les virements et les ajustements n'entrent jamais dans ces totaux.
 * Seules les transactions `posted` comptent.
 */
export function totals(transactions: readonly Transaction[]): Totals {
  const incomes: Minor[] = [];
  const expenses: Minor[] = [];
  for (const t of transactions) {
    if (t.status !== "posted") continue;
    if (t.type === "income") incomes.push(t.amount);
    if (t.type === "expense") expenses.push(t.amount);
  }
  const income = sumMinor(incomes);
  const expense = sumMinor(expenses);
  return { income, expense, net: income - expense };
}
