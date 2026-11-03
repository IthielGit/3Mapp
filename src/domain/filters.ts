import type { Transaction } from "../db/entities";
import type { Minor } from "../lib/money";

export type TransactionType = Transaction["type"];

export interface TransactionFilters {
  /** Bornes ISO UTC incluses sur la date de la transaction. */
  from?: string;
  to?: string;
  types?: readonly TransactionType[];
  walletId?: string;
  categoryId?: string;
  /** Montants en valeur absolue, unités mineures. */
  minAmount?: Minor;
  maxAmount?: Minor;
  /** Texte libre : mémo ou nom de catégorie. */
  query?: string;
}

/**
 * Filtre les transactions (SPEC §5.4).
 * `categoryNames` associe un id de catégorie à son nom, pour la recherche plein texte.
 */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
  categoryNames: ReadonlyMap<string, string> = new Map(),
): Transaction[] {
  const query = filters.query?.trim().toLocaleLowerCase("fr") ?? "";
  return transactions.filter((t) => {
    if (filters.from && t.date < filters.from) return false;
    if (filters.to && t.date > filters.to) return false;
    if (filters.types && filters.types.length > 0 && !filters.types.includes(t.type)) return false;
    if (filters.walletId && t.walletId !== filters.walletId && t.toWalletId !== filters.walletId) {
      return false;
    }
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;

    const absolute = Math.abs(t.amount);
    if (filters.minAmount !== undefined && absolute < filters.minAmount) return false;
    if (filters.maxAmount !== undefined && absolute > filters.maxAmount) return false;

    if (query !== "") {
      const category = t.categoryId ? (categoryNames.get(t.categoryId) ?? "") : "";
      const haystack = `${t.memo} ${category}`.toLocaleLowerCase("fr");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
