import {
  AMOUNT_SEPARATORS,
  getAmountFormat,
  parseMoney,
  type AmountFormat,
  type CurrencyCode,
  type Minor,
} from "./money";

/** Opérateurs de la calculatrice, acceptés seulement dans les champs d'expression. */
const OPERATORS = "+-−*/×÷()";

/**
 * Saisie du montant : la calculatrice garde une expression « brute » (chiffres, virgule décimale,
 * opérateurs). L'affichage ajoute les séparateurs de milliers et la décimale du réglage de format.
 * Les deux textes ont la même longueur, sauf les séparateurs de milliers insérés à l'affichage.
 */

/** Un nombre entier : pas précédé d'un chiffre ni d'une virgule (sinon c'est une partie décimale). */
const INTEGER_RUN = /(?<![\d,])\d+/g;

export interface DisplayExpression {
  /** Texte affiché dans le champ. */
  text: string;
  /** Position d'affichage de chaque position brute (de 0 à la longueur de l'expression incluse). */
  toDisplay: number[];
}

/** Expression brute → texte affiché, avec séparateurs de milliers et décimale du format. */
export function formatExpressionForDisplay(raw: string, format: AmountFormat = getAmountFormat()): DisplayExpression {
  const { group, decimal } = AMOUNT_SEPARATORS[format];

  // Positions devant lesquelles un séparateur de milliers est inséré : tous les 3 chiffres en partant de la droite.
  const groupBefore = new Set<number>();
  if (group) {
    for (const match of raw.matchAll(INTEGER_RUN)) {
      const start = match.index ?? 0;
      const length = match[0].length;
      for (let k = 1; k < length; k++) {
        if ((length - k) % 3 === 0) groupBefore.add(start + k);
      }
    }
  }

  let text = "";
  const toDisplay: number[] = [];
  for (let i = 0; i <= raw.length; i++) {
    if (groupBefore.has(i)) text += group;
    toDisplay.push(text.length);
    if (i < raw.length) text += raw[i] === "," ? decimal : raw[i];
  }
  return { text, toDisplay };
}

/** Texte affiché (tel que saisi dans le champ) → expression brute. */
export function rawFromDisplay(display: string, format: AmountFormat = getAmountFormat()): string {
  const { group, decimal } = AMOUNT_SEPARATORS[format];
  let raw = "";
  for (const char of display) {
    if (group && char === group) continue;
    raw += char === decimal ? "," : char;
  }
  return raw;
}

/** Position du curseur dans le texte affiché → position dans l'expression brute. */
export function rawIndexFromDisplay(
  display: string,
  displayIndex: number,
  format: AmountFormat = getAmountFormat(),
): number {
  const { group } = AMOUNT_SEPARATORS[format];
  let count = 0;
  const end = Math.min(displayIndex, display.length);
  for (let i = 0; i < end; i++) {
    if (!(group && display[i] === group)) count++;
  }
  return count;
}

/**
 * Texte d'un champ de montant (tel qu'affiché, avec séparateurs) → montant en unités mineures.
 * Les séparateurs de milliers saisis ou affichés sont ignorés.
 */
export function parseAmountText(
  display: string,
  code: CurrencyCode,
  format: AmountFormat = getAmountFormat(),
): Minor | null {
  return parseMoney(rawFromDisplay(display, format), code);
}

/**
 * Garde seulement les caractères utiles à la saisie (chiffres, décimale et groupement du format,
 * opérateurs si demandés). Le curseur suit les caractères conservés. Les séparateurs de milliers
 * sont retirés ensuite par rawFromDisplay, puis réinsérés à l'affichage.
 */
export function sanitizeAmountDisplay(
  display: string,
  cursor: number,
  allowOperators: boolean,
  format: AmountFormat = getAmountFormat(),
): { text: string; cursor: number } {
  const { group, decimal } = AMOUNT_SEPARATORS[format];
  let text = "";
  let at = cursor;
  let hasDecimal = false;
  for (let i = 0; i < display.length; i++) {
    const char = display[i] ?? "";
    // Une seule décimale par montant (une expression en contient une par nombre).
    const isDecimal = char === decimal;
    const keep =
      /\d/.test(char) ||
      (isDecimal && (allowOperators || !hasDecimal)) ||
      (group !== "" && char === group) ||
      (allowOperators && OPERATORS.includes(char));
    if (keep) {
      text += char;
      if (isDecimal) hasDecimal = true;
    } else if (i < cursor) at--;
  }
  return { text, cursor: at };
}
