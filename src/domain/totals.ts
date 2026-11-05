import type { Transaction } from "../db/entities";
import { sumMinor, type Minor } from "../lib/money";

export interface Totals {
  income: Minor;
  expense: Minor;
  /** Revenus − dépenses + ajustements (variation réelle du solde, comme sur l'Accueil). */
  net: Minor;
}

/**
 * Totaux revenus / dépenses (SPEC §6, règles 2 et 3).
 * Les virements n'entrent jamais dans ces totaux (ils restent entre deux portefeuilles).
 * Les ajustements (réconciliations) ne sont pas des revenus ni des dépenses, mais ils modifient
 * le solde : ils entrent donc dans le net, pour que « ce qui vous reste » corresponde aux soldes.
 * Seules les transactions `posted` comptent.
 */
export function totals(transactions: readonly Transaction[]): Totals {
  const incomes: Minor[] = [];
  const expenses: Minor[] = [];
  const adjustments: Minor[] = [];
  for (const t of transactions) {
    if (t.status !== "posted") continue;
    if (t.type === "income") incomes.push(t.amount);
    if (t.type === "expense") expenses.push(t.amount);
    if (t.type === "adjustment") adjustments.push(t.amount);
  }
  const income = sumMinor(incomes);
  const expense = sumMinor(expenses);
  const adjustment = sumMinor(adjustments);
  return { income, expense, net: income - expense + adjustment };
}
