import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { expressionToMinor } from "../lib/calc";
import { minorToPlainText } from "../lib/amount-text";
import { formatMoney, type CurrencyCode, type Minor } from "../lib/money";

const KEYS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  [",", "0", "⌫", "+"],
] as const;

interface AmountInputProps {
  /** Expression saisie, par ex. « 12,5+3 ». */
  expression: string;
  onExpressionChange: (expression: string) => void;
  currency: CurrencyCode;
  label: string;
}

/**
 * Saisie du montant avec calculatrice intégrée (SPEC §5.4) : + − × ÷, décimales,
 * « = » remplace l'expression par son résultat arrondi à la devise.
 */
export function AmountInput({ expression, onExpressionChange, currency, label }: AmountInputProps) {
  // Touche de zéros configurable dans Paramètres : « 00 » ou « 000 » (défaut : 000).
  const zeros =
    useLiveQuery(async () => (await db.settings.toCollection().first())?.keypadZeros, []) ?? 3;
  const zeroKey = zeros === 2 ? "00" : "000";

  const minor: Minor | null =
    expression.trim() === "" ? null : expressionToMinor(expression, currency);

  function press(key: string) {
    if (key === "⌫") {
      onExpressionChange(expression.slice(0, -1));
      return;
    }
    onExpressionChange(expression + key);
  }

  function equals() {
    if (minor === null) return;
    onExpressionChange(minorToPlainText(minor, currency));
  }

  let result = "";
  if (minor !== null) result = formatMoney(minor, currency);
  else if (expression.trim() !== "") result = "…";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col rounded-lg border border-slate-300 p-3 dark:border-slate-700">
        <label htmlFor="amount-expression" className="text-sm text-slate-500">
          {label}
        </label>
        <input
          id="amount-expression"
          inputMode="decimal"
          autoComplete="off"
          className="bg-transparent text-3xl font-semibold outline-none"
          value={expression}
          onChange={(e) => onExpressionChange(e.target.value)}
          aria-describedby="amount-result"
        />
        <output id="amount-result" aria-live="polite" className="text-sm text-slate-500">
          {result}
        </output>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "⌫" ? "Effacer" : key}
            className="min-h-[52px] rounded-lg border border-slate-300 text-xl font-medium dark:border-slate-700"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onExpressionChange("")}
          className="min-h-[44px] rounded-lg border border-slate-300 font-medium dark:border-slate-700"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => press(zeroKey)}
          aria-label={zeroKey}
          className="min-h-[44px] rounded-lg border border-slate-300 text-lg font-medium tabular-nums dark:border-slate-700"
        >
          {zeroKey}
        </button>
        <button
          type="button"
          onClick={equals}
          disabled={minor === null}
          className="min-h-[44px] rounded-lg bg-brand-700 font-semibold text-white disabled:opacity-50"
        >
          =
        </button>
      </div>
    </div>
  );
}
