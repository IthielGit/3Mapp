import type { ExchangeRate } from "../db/entities";
import { getCurrency, sumMinor, type CurrencyCode, type Minor } from "../lib/money";

/**
 * Taux de change (SPEC §3) : un taux est « combien de `to` pour 1 `from` », daté.
 * On utilise le dernier taux connu à la date demandée ; le taux inverse est déduit si besoin.
 */
export function rateAt(
  rates: readonly ExchangeRate[],
  from: CurrencyCode,
  to: CurrencyCode,
  date: Date,
): number | null {
  if (from === to) return 1;
  const time = date.getTime();
  let best: ExchangeRate | undefined;
  for (const r of rates) {
    if (r.from === from && r.to === to && new Date(r.date).getTime() <= time) {
      if (!best || r.date > best.date) best = r;
    }
  }
  if (best) return best.rate;
  // Taux inverse : on prend le dernier taux « to → from » et on l'inverse.
  for (const r of rates) {
    if (r.from === to && r.to === from && new Date(r.date).getTime() <= time) {
      if (!best || r.date > best.date) best = r;
    }
  }
  return best ? 1 / best.rate : null;
}

/**
 * Convertit un montant en unités mineures d'une devise vers une autre, sans arrondi.
 * Les décimales sont prises en compte : 12,50 EUR (1250 centimes) × 5 000 Ar/EUR = 62 500 Ar.
 */
export function convertRaw(
  amount: Minor,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number,
): number {
  const fromDec = getCurrency(from).decimals;
  const toDec = getCurrency(to).decimals;
  return amount * rate * 10 ** (toDec - fromDec);
}

export interface ConvertedTotal {
  /** Total en devise de référence, arrondi une seule fois à la fin. */
  total: Minor;
  /** Devises pour lesquelles aucun taux n'existe : elles ne sont pas comptées. */
  missing: CurrencyCode[];
}

/** Somme de montants de devises mélangées, convertis au taux de leur date ; arrondi une seule fois. */
export function convertedSum(
  items: readonly { amount: Minor; currency: CurrencyCode; date: string }[],
  base: CurrencyCode,
  rates: readonly ExchangeRate[],
): ConvertedTotal {
  const parts: number[] = [];
  const missing = new Set<CurrencyCode>();
  for (const item of items) {
    const rate = rateAt(rates, item.currency, base, new Date(item.date));
    if (rate === null) {
      missing.add(item.currency);
      continue;
    }
    parts.push(convertRaw(item.amount, item.currency, base, rate));
  }
  const exact = parts.reduce((a, b) => a + b, 0);
  return { total: sumMinor([Math.round(exact)]), missing: [...missing] };
}
