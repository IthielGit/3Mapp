import { getCurrency, type CurrencyCode, type Minor } from "./money";

/**
 * Montant en unités mineures → texte de saisie brut (ex. 1250 EUR → « 12.50 », 1500 MGA → « 1500 »).
 * Relisible par la calculatrice et par parseMoney.
 */
export function minorToPlainText(minor: Minor, currency: CurrencyCode): string {
  const { decimals } = getCurrency(currency);
  const sign = minor < 0 ? "-" : "";
  const digits = Math.abs(minor)
    .toString()
    .padStart(decimals + 1, "0");
  const int = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals);
  return decimals > 0 ? `${sign}${int}.${frac}` : `${sign}${int}`;
}

/**
 * Montant en unités mineures → texte de la calculatrice (virgule décimale, comme la saisie au clavier).
 * Même valeur que minorToPlainText, sans le point : l'affichage du montant suit le réglage de format.
 */
export function minorToEntryText(minor: Minor, currency: CurrencyCode): string {
  return minorToPlainText(minor, currency).replace(".", ",");
}
