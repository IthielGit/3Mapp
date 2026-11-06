import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../db/database";
import { expressionToMinor } from "../lib/calc";
import { minorToEntryText } from "../lib/amount-text";
import { formatExpressionForDisplay, rawFromDisplay, rawIndexFromDisplay } from "../lib/amount-entry";
import { formatMoney, type CurrencyCode, type Minor } from "../lib/money";

// Pavé de chiffres : le mode par défaut. "000" devient "00" selon le réglage.
const DIGIT_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [",", "0", "000"],
] as const;

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
  /** Appelé par Entrée une fois le calcul fait (ferme le pavé, sans enregistrer). */
  onConfirm?: () => void;
}

/** Caractères acceptés au clavier physique : chiffres et opérateurs de la calculatrice. */
const TYPABLE = /^[0-9,+\-−*/×÷()]$/;

/**
 * Saisie du montant avec calculatrice intégrée (SPEC §5.4) : + − × ÷, décimales,
 * « = » remplace l'expression par son résultat arrondi à la devise.
 * Les touches s'insèrent à la position du curseur, et « ⌫ » efface le caractère qui le précède.
 * Le curseur reste visible dans le champ, même quand on touche le pavé.
 */
export function AmountInput({ expression, onExpressionChange, currency, label, onConfirm }: AmountInputProps) {
  // Touche de zéros configurable dans Paramètres : « 00 » ou « 000 » (défaut : 000).
  const zeros =
    useLiveQuery(async () => (await db.settings.toCollection().first())?.keypadZeros, []) ?? 3;
  const zeroKey = zeros === 2 ? "00" : "000";
  const { t } = useTranslation();
  // Opérations (+ − × ÷) masquées par défaut : on les ouvre seulement si on en a besoin.
  const [calc, setCalc] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Position du curseur ; null = fin de l'expression. La réf sert aux gestionnaires, l'état au rendu.
  const caretRef = useRef<number | null>(null);
  const [caret, setCaretState] = useState<number | null>(null);
  // Position à appliquer au champ natif après le rendu suivant.
  const pendingCaret = useRef<number | null>(null);

  function moveCaret(value: number | null) {
    caretRef.current = value;
    setCaretState(value);
  }

  // Le champ prend le focus à l'ouverture du pavé : les touches du clavier vont directement dans le montant.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && pendingCaret.current !== null) {
      // La position est gardée en expression brute ; l'affichage peut avoir des séparateurs en plus.
      const at = formatExpressionForDisplay(expression).toDisplay[pendingCaret.current] ?? el.value.length;
      el.setSelectionRange(at, at);
      pendingCaret.current = null;
    }
  }, [expression]);

  /** Clavier physique : chiffres, virgule ou point, opérateurs, Retour arrière, Entrée pour valider. */
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (/[+\-−*/×÷]/.test(expression.slice(1))) equals();
      onConfirm?.();
      return;
    }
    if (event.key === "." || event.key === ",") {
      event.preventDefault();
      press(",");
      return;
    }
    if (event.key === "x" || event.key === "X") {
      event.preventDefault();
      press("×");
      return;
    }
    if (event.key.length === 1 && !TYPABLE.test(event.key)) event.preventDefault();
  }

  const minor: Minor | null =
    expression.trim() === "" ? null : expressionToMinor(expression, currency);

  /** Le curseur lu dans le champ (texte affiché) est gardé en position de l'expression brute. */
  function rememberCaret(el: HTMLInputElement) {
    moveCaret(rawIndexFromDisplay(el.value, el.selectionStart ?? el.value.length));
  }

  function press(key: string) {
    const len = expression.length;
    const pos = Math.min(caretRef.current ?? len, len);
    let next: string;
    let at: number;
    if (key === "⌫") {
      if (pos === 0) return;
      next = expression.slice(0, pos - 1) + expression.slice(pos);
      at = pos - 1;
    } else {
      next = expression.slice(0, pos) + key + expression.slice(pos);
      at = pos + key.length;
    }
    moveCaret(at);
    pendingCaret.current = at;
    onExpressionChange(next);
  }

  function clear() {
    moveCaret(0);
    onExpressionChange("");
  }

  function equals() {
    if (minor === null) return;
    moveCaret(null);
    onExpressionChange(minorToEntryText(minor, currency));
  }

  // Position affichée : jamais au-delà de la fin de l'expression.
  const shownAt = Math.min(caret ?? expression.length, expression.length);
  // Texte affiché avec séparateurs (réglage « Format des montants »), et position du curseur dans ce texte.
  const display = formatExpressionForDisplay(expression);
  const displayShownAt = display.toDisplay[shownAt] ?? display.text.length;

  let result = "";
  if (minor !== null) result = formatMoney(minor, currency);
  else if (expression.trim() !== "") result = "…";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col rounded-lg border border-neutral-500 px-3 py-2 dark:border-white/15">
        <label htmlFor="amount-expression" className="text-sm text-neutral-600 dark:text-muted">
          {label}
        </label>
        <div className="relative">
          <input
            id="amount-expression"
            ref={inputRef}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            // Le curseur est dessiné par la superposition ci-dessous : celui du navigateur est masqué.
            className="w-full bg-transparent text-3xl font-semibold caret-transparent outline-none placeholder:text-neutral-600 dark:placeholder:text-muted"
            value={display.text}
            onChange={(e) => {
              const el = e.currentTarget;
              const at = rawIndexFromDisplay(el.value, el.selectionStart ?? el.value.length);
              // Le champ se reformate à la prochaine rendu : le curseur est replacé d'après la position brute.
              moveCaret(at);
              pendingCaret.current = at;
              onExpressionChange(rawFromDisplay(el.value));
            }}
            onKeyDown={onKeyDown}
            onSelect={(e) => rememberCaret(e.currentTarget)}
            onKeyUp={(e) => rememberCaret(e.currentTarget)}
            onClick={(e) => rememberCaret(e.currentTarget)}
            aria-describedby="amount-result"
          />
          {expression !== "" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center whitespace-pre text-3xl font-semibold"
            >
              <span className="invisible">{display.text.slice(0, displayShownAt)}</span>
              <span className="h-9 w-0.5 rounded-full bg-brand-600 caret-blink dark:bg-brand-dark" />
              <span className="invisible">{display.text.slice(displayShownAt)}</span>
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center text-3xl font-semibold"
            >
              <span className="h-9 w-0.5 rounded-full bg-brand-600 caret-blink dark:bg-brand-dark" />
            </div>
          )}
        </div>
        <output id="amount-result" aria-live="polite" className="text-sm text-neutral-600 dark:text-muted">
          {result}
        </output>
      </div>

      {calc ? (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {KEYS.flat().map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === "⌫" ? t("transactions.erase") : key}
                className="min-h-[44px] rounded-lg border border-neutral-500 text-xl font-medium dark:border-white/15"
              >
                {key}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" onClick={clear} className="min-h-[44px] rounded-lg border border-neutral-500 font-medium dark:border-white/15">
              C
            </button>
            <button
              type="button"
              onClick={() => press(zeroKey)}
              aria-label={zeroKey}
              className="min-h-[44px] rounded-lg border border-neutral-500 text-lg font-medium tabular-nums dark:border-white/15"
            >
              {zeroKey}
            </button>
            <button
              type="button"
              onClick={equals}
              disabled={minor === null}
              className="min-h-[44px] rounded-lg bg-brand-600 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-ink dark:disabled:bg-raised dark:disabled:text-muted dark:disabled:opacity-100"
            >
              =
            </button>
            <button
              type="button"
              onClick={() => setCalc(false)}
              className="min-h-[44px] rounded-lg border border-neutral-500 text-sm font-medium dark:border-white/15"
            >
              {t("transactions.digits")}
            </button>
          </div>
        </>
      ) : (
        // Mode par défaut : chiffres seulement. Les opérations sont derrière « + − × ÷ ».
        <div className="grid grid-cols-3 gap-1.5">
          {DIGIT_KEYS.flat().map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key === "000" ? zeroKey : key)}
              aria-label={key === "000" ? zeroKey : key}
              className="min-h-[44px] rounded-lg border border-neutral-500 text-xl font-medium tabular-nums dark:border-white/15"
            >
              {key === "000" ? zeroKey : key}
            </button>
          ))}
          <button type="button" onClick={() => press("⌫")} aria-label={t("transactions.erase")} className="min-h-[44px] rounded-lg border border-neutral-500 text-xl font-medium dark:border-white/15">
            ⌫
          </button>
          <button type="button" onClick={clear} className="min-h-[44px] rounded-lg border border-neutral-500 font-medium dark:border-white/15">
            C
          </button>
          <button
            type="button"
            onClick={() => setCalc(true)}
            className="min-h-[44px] rounded-lg border border-neutral-500 text-sm font-medium dark:border-white/15"
          >
            {t("transactions.calc")}
          </button>
        </div>
      )}
    </div>
  );
}
