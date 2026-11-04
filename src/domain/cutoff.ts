import type { Transaction } from "../db/entities";

/**
 * Ne garde que les transactions datées au plus tard à `cutoff` (les mouvements à venir sont exclus).
 * Sans `cutoff`, toutes les transactions sont gardées. Même règle pour les soldes et les totaux.
 */
export function upTo<T extends Pick<Transaction, "date">>(items: readonly T[], cutoff?: Date): T[] {
  if (!cutoff) return [...items];
  const limit = cutoff.getTime();
  return items.filter((item) => new Date(item.date).getTime() <= limit);
}
