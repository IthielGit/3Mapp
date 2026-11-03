import { format } from "date-fns";
import type { Transaction } from "../db/entities";
import { totals } from "./totals";
import type { Minor } from "../lib/money";

export interface DayGroup {
  /** Jour local au format yyyy-MM-dd. */
  day: string;
  items: Transaction[];
  /** Revenus − dépenses du jour (hors virements et ajustements). */
  net: Minor;
}

/**
 * Regroupe des transactions déjà triées par date par jour local.
 * L'ordre d'entrée est conservé à l'intérieur de chaque groupe.
 */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const day = format(new Date(t.date), "yyyy-MM-dd");
    const bucket = groups.get(day);
    if (bucket) bucket.push(t);
    else groups.set(day, [t]);
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items, net: totals(items).net }));
}
