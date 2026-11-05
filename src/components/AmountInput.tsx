import { useLayoutEffect, useRef } from "react";
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
 * Les touches s'insèrent à la position du curseur (et « ⌫ » efface avant le curseur).
 */
export function AmountInput({ expression, onExpressionChange, currency, label }: AmountInputProps) {
  // Touche de zéros configurable dans Paramètres : « 00 » ou « 000 » (défaut : 000).
  const zeros =
    useLiveQuery(async () => (await db.settings.toCollection().first())?.keypadZeros, []) ?? 3;
  const zeroKey = zeros === 2 ? "00" : "000";

  const inputRef = useRef<HTMLInputElement>(null);
  // Dernière position connue du curseur ; null = fin de l'expression.
  const caretRef = useRef<number | null>(null);
  // Position à appliquer après le rendu suivant (les touches changent la valeur).
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [expression]);

  const minor: Minor | null =
    expression.trim() === "" ? null : expressionToMinor(expression, currency);

  function rememberCaret(el: HTMLInputElement) {
    caretRef.current = el.selectionStart ?? el.value.length;
  }

  function press(key: string) {
    const len = expression.length;
    const pos = Math.min(caretRef.current ?? len, len);
    let next: string;
    let caret: number;
    if (key === "⌫") {
      if (pos === 0) return;
      next = expression.slice(0, pos - 1) + expression.slice(pos);
      caret = pos - 1;
    } else {
      next = expression.slice(0, pos) + key + expression.slice(pos);
      caret = pos + key.length;
    }
    caretRef.current = caret;
    pendingCaret.current = caret;
    onExpressionChange(next);
  }

  function clear() {
    caretRef.current = 0;
    onExpressionChange("");
  }

  function equals() {
    if (minor === null) return;
    caretRef.current = null;
    onExpressionChange(minorToPlainText(minor, currency));
  }

  let result = "";
  if (minor !== null) result = formatMoney(minor, currency);
  else if (expression.trim() !== "") result = "…";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col rounded-lg border border-slate-300 px-3 py-2 dark:border-white/15">
        <label htmlFor="amount-expression" className="text-sm text-slate-600 dark:text-muted">
          {label}
        </label>
        <input
          id="amount-expression"
          ref={inputRef}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          className="bg-transparent text-3xl font-semibold outline-none placeholder:text-slate-400 dark:placeholder:text-muted"
          value={expression}
          onChange={(e) => {
            rememberCaret(e.currentTarget);
            onExpressionChange(e.target.value);
          }}
          onSelect={(e) => rememberCaret(e.currentTarget)}
          onKeyUp={(e) => rememberCaret(e.currentTarget)}
          onClick={(e) => rememberCaret(e.currentTarget)}
          aria-describedby="amount-result"
        />
        <output id="amount-result" aria-live="polite" className="text-sm text-slate-600 dark:text-muted">
          {result}
        </output>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "⌫" ? "Effacer" : key}
            className="min-h-[44px] rounded-lg border border-slate-300 text-xl font-medium dark:border-white/15"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={clear}
          className="min-h-[44px] rounded-lg border border-slate-300 font-medium dark:border-white/15"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => press(zeroKey)}
          aria-label={zeroKey}
          className="min-h-[44px] rounded-lg border border-slate-300 text-lg font-medium tabular-nums dark:border-white/15"
        >
          {zeroKey}
        </button>
        <button
          type="button"
          onClick={equals}
          disabled={minor === null}
          className="min-h-[44px] rounded-lg bg-brand-700 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-ink dark:disabled:bg-raised dark:disabled:text-muted dark:disabled:opacity-100"
        >
          =
        </button>
      </div>
    </div>
  );
}
