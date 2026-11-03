import type { Transaction, Wallet } from "../db/entities";
import { sumMinor, type CurrencyCode, type Minor } from "../lib/money";
import { contains, localDayKey, type Period } from "./period";
import { totals, type Totals } from "./totals";

/** Transactions de la devise choisie, comprises dans la période, dans l'ordre chronologique. */
export function transactionsIn(
  transactions: readonly Transaction[],
  period: Period,
  currency: CurrencyCode,
): Transaction[] {
  return transactions
    .filter((t) => t.currency === currency && contains(period, t.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface PeriodSummary extends Totals {
  /** (revenus − dépenses) / revenus, en pourcentage arrondi ; null sans revenus. Virements exclus. */
  savingsRate: number | null;
  /** Dépense moyenne par jour écoulé dans la période (au plus la durée de la période). */
  dailyExpenseAverage: Minor;
}

export function periodSummary(
  transactions: readonly Transaction[],
  period: Period,
  now = new Date(),
): PeriodSummary {
  const base = totals(transactions);
  const dayMs = 24 * 60 * 60 * 1000;
  const endMs = Math.min(period.to.getTime(), now.getTime());
  const elapsedDays = Math.max(1, Math.ceil((endMs - period.from.getTime()) / dayMs));
  return {
    ...base,
    savingsRate: base.income > 0 ? Math.round((base.net * 100) / base.income) : null,
    dailyExpenseAverage: Math.round(base.expense / elapsedDays),
  };
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  amount: Minor;
  share: number;
}

/** Dépenses par catégorie, de la plus grosse à la plus petite. Sans catégorie : libellé dédié. */
export function expenseByCategory(
  transactions: readonly Transaction[],
  names: ReadonlyMap<string, string>,
  uncategorisedLabel = "Sans catégorie",
): CategorySlice[] {
  const expenses = transactions.filter((t) => t.type === "expense" && t.status === "posted");
  const groups = new Map<string | null, Minor[]>();
  for (const t of expenses) {
    const key = t.categoryId ?? null;
    const bucket = groups.get(key);
    if (bucket) bucket.push(t.amount);
    else groups.set(key, [t.amount]);
  }
  const total = sumMinor(expenses.map((t) => t.amount));
  return [...groups.entries()]
    .map(([categoryId, amounts]) => {
      const amount = sumMinor(amounts);
      return {
        categoryId,
        name:
          categoryId === null ? uncategorisedLabel : (names.get(categoryId) ?? uncategorisedLabel),
        amount,
        share: total === 0 ? 0 : Math.round((amount * 1000) / total) / 10,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export interface Bucket {
  key: string;
  income: Minor;
  expense: Minor;
}

/** Totaux par seau (semaine, mois…). Virements et ajustements exclus. */
export function bucketTotals(
  transactions: readonly Transaction[],
  keyOf: (t: Transaction) => string,
  keys: readonly string[],
): Bucket[] {
  const result = new Map<string, { income: Minor[]; expense: Minor[] }>(
    keys.map((k) => [k, { income: [], expense: [] }]),
  );
  for (const t of transactions) {
    if (t.status !== "posted") continue;
    const bucket = result.get(keyOf(t));
    if (!bucket) continue;
    if (t.type === "income") bucket.income.push(t.amount);
    if (t.type === "expense") bucket.expense.push(t.amount);
  }
  return keys.map((key) => {
    const bucket = result.get(key) ?? { income: [], expense: [] };
    return { key, income: sumMinor(bucket.income), expense: sumMinor(bucket.expense) };
  });
}

/** Les N plus grosses dépenses, de la plus grande à la plus petite. */
export function topExpenses(transactions: readonly Transaction[], count = 10): Transaction[] {
  return transactions
    .filter((t) => t.type === "expense" && t.status === "posted")
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date))
    .slice(0, count);
}

function signedEffect(t: Transaction): Minor {
  if (t.type === "income") return t.amount;
  if (t.type === "expense") return -t.amount;
  if (t.type === "adjustment") return t.amount;
  if (t.type === "transfer") return -(t.fee ?? 0); // un virement interne ne change pas le total
  return 0;
}

/**
 * Solde total jour par jour (devise choisie), pour les jours `dayKeys` (clés locales yyyy-MM-dd, triées).
 * Le point de départ inclut tous les mouvements antérieurs au premier jour.
 */
export function balanceEvolution(
  wallets: readonly Pick<Wallet, "initialBalance" | "currency">[],
  transactions: readonly Transaction[],
  dayKeys: readonly string[],
  currency: CurrencyCode,
): { day: string; balance: Minor }[] {
  if (dayKeys.length === 0) return [];
  const sorted = [...dayKeys].sort();
  const first = sorted[0] ?? "";
  const initial = sumMinor(
    wallets.filter((w) => w.currency === currency).map((w) => w.initialBalance),
  );

  const effectByDay = new Map<string, Minor>();
  let before = initial;
  for (const t of transactions) {
    if (t.currency !== currency) continue;
    const effect = signedEffect(t);
    if (effect === 0 || t.status !== "posted") continue;
    const day = localDayKey(t.date);
    if (day < first) {
      before += effect;
    } else {
      effectByDay.set(day, (effectByDay.get(day) ?? 0) + effect);
    }
  }

  let running = before;
  return sorted.map((day) => {
    running += effectByDay.get(day) ?? 0;
    return { day, balance: running };
  });
}
