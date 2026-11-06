/**
 * Montants d'argent (SPEC §3).
 *
 * Un montant est un entier en unités mineures : 1 Ar = 1 unité (MGA a 0 décimale),
 * 12,50 € = 1250 centimes. Aucun float ne circule dans les calculs ; les nombres à
 * virgule ne servent qu'à l'affichage et sont convertis une seule fois, à la saisie.
 */

export type CurrencyCode = "MGA" | "EUR" | "USD";

/** Montant exprimé en unités mineures (entier sûr, signé). */
export type Minor = number;

export interface CurrencyDef {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
  symbolPosition: "before" | "after";
}

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyDef>> = {
  MGA: { code: "MGA", name: "Ariary malgache", symbol: "Ar", decimals: 0, symbolPosition: "after" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2, symbolPosition: "after" },
  USD: {
    code: "USD",
    name: "Dollar américain",
    symbol: "$",
    decimals: 2,
    symbolPosition: "before",
  },
};

/**
 * Style d'affichage des montants (réglage « Format des montants »).
 * dot : 1.000.000,00 (défaut) · space : 1 000 000,00 · comma : 1,000,000.00 · plain : 1000000,00
 */
export const AMOUNT_FORMATS = ["dot", "space", "comma", "plain"] as const;
export type AmountFormat = (typeof AMOUNT_FORMATS)[number];

/** Séparateur de milliers et séparateur décimal de chaque style. */
export const AMOUNT_SEPARATORS: Readonly<Record<AmountFormat, { group: string; decimal: string }>> = {
  dot: { group: ".", decimal: "," },
  space: { group: " ", decimal: "," }, // espace fine insécable
  comma: { group: ",", decimal: "." },
  plain: { group: "", decimal: "," },
};

/** Style utilisé par formatMoney quand l'appelant n'en précise pas. Mis à jour depuis les réglages. */
let activeAmountFormat: AmountFormat = "dot";

export function setAmountFormat(format: AmountFormat | undefined): void {
  activeAmountFormat = format ?? "dot";
}

export function getAmountFormat(): AmountFormat {
  return activeAmountFormat;
}

const MINUS_SIGN = "−";
const NBSP = " ";

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function getCurrency(code: CurrencyCode): CurrencyDef {
  const def = CURRENCIES[code];
  if (!def) throw new MoneyError(`Devise inconnue : ${code}`);
  return def;
}

/** Unités mineures → unités majeures selon la devise (MGA : 1 pour 1 ; EUR/USD : ÷ 100). */
export function minorToMajor(value: Minor, code: CurrencyCode): number {
  return value / 10 ** getCurrency(code).decimals;
}

/** Unités majeures → unités mineures selon la devise, arrondies. */
export function majorToMinor(value: number, code: CurrencyCode): Minor {
  return Math.round(value * 10 ** getCurrency(code).decimals);
}

/** Vérifie qu'une valeur est un montant valide (entier sûr). */
export function assertMinor(value: number): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Montant invalide (entier attendu) : ${value}`);
  }
}

/** Somme de montants en unités mineures, avec contrôle de dépassement. */
export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0;
  for (const value of values) {
    assertMinor(value);
    total += value;
    assertMinor(total);
  }
  return total;
}

/**
 * Division arrondie à l'entier le plus proche, moitiés vers l'infini (5 → 3, −5 → −3).
 * À utiliser une seule fois, en fin de calcul (ex. conversion de devise, pourcentage).
 */
export function roundedDivide(numerator: number, denominator: number): number {
  if (denominator === 0) throw new MoneyError("Division par zéro");
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  const absN = Math.abs(numerator);
  const absD = Math.abs(denominator);
  return sign * Math.floor((absN * 2 + absD) / (absD * 2));
}

/**
 * Lit une saisie utilisateur (« 1 500 », « 12,50 », « 1.234,5 », « -3 ») et la convertit en unités mineures.
 * Retourne null si la saisie est invalide ou si elle a plus de décimales que la devise n'en admet :
 * on refuse d'arrondir silencieusement une saisie.
 */
export function parseMoney(input: string, code: CurrencyCode): Minor | null {
  const { decimals } = getCurrency(code);

  let text = input
    .replace(/MGA|EUR|USD|Ar|€|\$/gi, "")
    .replace(/\s/g, "")
    .trim();

  let sign = 1;
  if (text.startsWith("-") || text.startsWith(MINUS_SIGN)) {
    sign = -1;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  if (text === "") return null;

  const separators = text.replace(/[^.,]/g, "");
  if (!/^\d+([.,]\d+)*$/.test(text)) return null;

  let intDigits: string;
  let fracDigits: string;

  if (separators.length === 0) {
    intDigits = text;
    fracDigits = "";
  } else if (text.includes(".") && text.includes(",")) {
    // Deux sortes de séparateurs : le dernier est la décimale, l'autre le groupement.
    const lastIndex = Math.max(text.lastIndexOf("."), text.lastIndexOf(","));
    intDigits = text.slice(0, lastIndex).replace(/[.,]/g, "");
    fracDigits = text.slice(lastIndex + 1);
  } else if (separators.length > 1) {
    // Même séparateur répété : c'est un groupement de milliers (1.234.567).
    intDigits = text.replace(/[.,]/g, "");
    fracDigits = "";
  } else {
    // Un seul séparateur : décimale, sauf « 1,500 » pour une devise sans décimale → milliers.
    const [head = "", tail = ""] = text.split(/[.,]/);
    if (decimals === 0 && tail.length === 3) {
      intDigits = head + tail;
      fracDigits = "";
    } else {
      intDigits = head;
      fracDigits = tail;
    }
  }

  if (decimals === 0) {
    // Devise sans décimales : seuls des zéros après le séparateur sont tolérés (« 375000.00 »).
    if (!/^0*$/.test(fracDigits)) return null;
  } else if (fracDigits.length > decimals) {
    return null;
  }

  const padded = decimals === 0 ? "" : fracDigits.padEnd(decimals, "0");
  const value = Number(intDigits + padded);
  if (!Number.isSafeInteger(value)) return null;
  return sign * value;
}

interface FormatOptions {
  /** Affiche le symbole de devise (défaut : true). */
  withSymbol?: boolean;
  /** Affiche « + » devant les montants positifs (défaut : false). */
  showPlus?: boolean;
  /** Style de séparateurs (défaut : le réglage de l'app). */
  format?: AmountFormat;
}

/**
 * Formate un montant en unités mineures pour l'affichage (format français).
 * Le formatage est fait en chaînes, sans passer par un float.
 * formatMoney(-1500, 'MGA') → « −1 500 Ar » (espaces fines insécables).
 */
export function formatMoney(
  amount: Minor,
  code: CurrencyCode,
  options: FormatOptions = {},
): string {
  assertMinor(amount);
  const { withSymbol = true, showPlus = false, format = activeAmountFormat } = options;
  const { group, decimal } = AMOUNT_SEPARATORS[format];
  const def = getCurrency(code);

  const digits = Math.abs(amount)
    .toString()
    .padStart(def.decimals + 1, "0");
  const intPart = digits.slice(0, digits.length - def.decimals);
  const fracPart = digits.slice(digits.length - def.decimals);
  const grouped = group ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group) : intPart;
  const number = def.decimals > 0 ? `${grouped}${decimal}${fracPart}` : grouped;

  const sign = amount < 0 ? MINUS_SIGN : showPlus && amount > 0 ? "+" : "";
  if (!withSymbol) return `${sign}${number}`;

  return def.symbolPosition === "before"
    ? `${sign}${def.symbol}${number}`
    : `${sign}${number}${NBSP}${def.symbol}`;
}
