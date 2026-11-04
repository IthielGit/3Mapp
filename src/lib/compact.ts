/**
 * Abréviations des axes de graphiques : 950, 3.2K, 3.5M, 1.2B.
 * Les infobulles gardent le montant exact (formatMoney) ; ceci ne sert qu'à lire l'axe.
 */
export function compactAmount(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const short = (n: number, suffix: string) => {
    const text = n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text}${suffix}`;
  };
  if (abs >= 1_000_000_000) return short(abs / 1_000_000_000, "B");
  if (abs >= 1_000_000) return short(abs / 1_000_000, "M");
  if (abs >= 1_000) return short(abs / 1_000, "K");
  return `${sign}${Math.round(abs)}`;
}
