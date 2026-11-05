import type { ExchangeRate, Transaction, Wallet } from "../db/entities";
import { computeBalances } from "./balance";
import { convertedSum } from "./fx";
import type { CurrencyCode } from "../lib/money";
import { isSpending } from "./totals";

/**
 * Séries des mini-graphiques de l'accueil. Chaque point suit la même règle que le solde affiché :
 * portefeuilles inclus dans le total, conversion à la devise de référence au taux du jour.
 */

/** Fin de journée locale pour une date AAAA-MM-JJ. */
function endOfLocalDay(day: string): Date {
  return new Date(`${day}T23:59:59.999`);
}

/**
 * Solde total (unités mineures) à la fin de chaque jour. Le dernier point reprend exactement
 * le calcul du solde affiché (`headlineCutoff`), pour que la courbe finisse sur le chiffre visible.
 */
export function dailyTotals(
  wallets: readonly Wallet[],
  transactions: readonly Transaction[],
  days: readonly string[],
  baseCurrency: CurrencyCode,
  rates: readonly ExchangeRate[],
  headlineCutoff: Date | undefined,
  now: Date = new Date(),
): number[] {
  const included = wallets.filter((w) => w.includeInTotal && !w.archived);
  return days.map((day, index) => {
    const isLast = index === days.length - 1;
    const end = endOfLocalDay(day);
    // Pas de transaction au-delà de maintenant, ni au-delà de la coupure des soldes.
    let asOf = end.getTime() > now.getTime() ? now : end;
    if (isLast) asOf = headlineCutoff ?? asOf;
    else if (headlineCutoff && asOf.getTime() > headlineCutoff.getTime()) asOf = headlineCutoff;

    const balances = computeBalances(included, transactions, asOf);
    const items = included.map((w) => ({
      amount: balances[w.id] ?? w.initialBalance,
      currency: w.currency,
      date: asOf.toISOString(),
    }));
    return convertedSum(items, baseCurrency, rates).total;
  });
}

/** Dépenses (devise de référence) de chaque jour : on ne compte que les dépenses, pas les virements. */
export function dailyExpenses(
  transactions: readonly Transaction[],
  days: readonly string[],
  baseCurrency: CurrencyCode,
): number[] {
  const sums = new Map<string, number>(days.map((d) => [d, 0]));
  for (const tx of transactions) {
    if (!isSpending(tx) || tx.currency !== baseCurrency) continue;
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + tx.amount);
  }
  return days.map((d) => sums.get(d) ?? 0);
}
