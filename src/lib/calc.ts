import type { CurrencyCode, Minor } from "./money";
import { getCurrency } from "./money";

const TOKEN = /\d+(?:\.\d+)?|[+\-*/]/y;
const NUMBER = /^\d+(?:\.\d+)?$/;

function readNumber(token: string | undefined): number | null {
  if (token === undefined || !NUMBER.test(token)) return null;
  return Number(token);
}

/**
 * Évalue une expression saisie à la calculatrice : nombres décimaux, + − × ÷ (et * /),
 * priorité habituelle, signe moins initial autorisé. Retourne null si l'expression est incomplète
 * ou invalide, ou si elle divise par zéro.
 * Pas d'eval : on découpe en jetons puis on lit « nombre (opérateur nombre)* ».
 */
export function evaluateExpression(raw: string): number | null {
  const source = raw
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  if (source === "") return null;

  const tokens: string[] = [];
  let pos = 0;
  while (pos < source.length) {
    TOKEN.lastIndex = pos;
    const match = TOKEN.exec(source);
    if (!match) return null;
    tokens.push(match[0]);
    pos = TOKEN.lastIndex;
  }

  // Un signe moins en tête ouvre un terme négatif : 0 − terme.
  if (tokens[0] === "-") tokens.unshift("0");

  // total = somme des termes signés ; term = terme courant (suite de * et /).
  let total = 0;
  let sign: 1 | -1 = 1;
  let term = readNumber(tokens[0]);
  if (term === null) return null;

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const value = readNumber(tokens[i + 1]);
    if (value === null) return null;

    if (op === "*") {
      term *= value;
    } else if (op === "/") {
      if (value === 0) return null;
      term /= value;
    } else if (op === "+" || op === "-") {
      total += sign * term;
      sign = op === "+" ? 1 : -1;
      term = value;
    } else {
      return null;
    }
  }

  total += sign * term;
  return Number.isFinite(total) ? total : null;
}

/**
 * Convertit une expression en unités mineures d'une devise.
 * Un seul arrondi, en fin de calcul, sur le nombre de décimales de la devise.
 */
export function expressionToMinor(raw: string, code: CurrencyCode): Minor | null {
  const value = evaluateExpression(raw);
  if (value === null) return null;
  const { decimals } = getCurrency(code);
  const scaled = Math.round(value * 10 ** decimals);
  return Number.isSafeInteger(scaled) ? scaled : null;
}
