import { useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import {
  formatExpressionForDisplay,
  rawFromDisplay,
  rawIndexFromDisplay,
  sanitizeAmountDisplay,
} from "../lib/amount-entry";

type NativeInputProps = Omit<ComponentPropsWithoutRef<"input">, "value" | "defaultValue" | "onChange" | "type">;

export interface AmountTextInputProps extends NativeInputProps {
  /** Texte affiché (contrôlé). Sans cette prop, le champ garde son propre texte, initialisé par defaultValue. */
  value?: string;
  defaultValue?: string;
  /** Appelé à chaque frappe avec le texte formaté (séparateurs du réglage « Format des montants »). */
  onValueChange?: (display: string) => void;
  /** Accepte + − × ÷ ( ) pour les champs qui acceptent une expression de calcul. */
  allowOperators?: boolean;
}

/**
 * Champ de montant : se reformate pendant la frappe (1500000 → 1.500.000) et garde le curseur en place.
 * Lire la valeur avec parseAmountText (ou expressionToMinor sur rawFromDisplay pour une expression).
 */
export function AmountTextInput({
  value,
  defaultValue = "",
  onValueChange,
  allowOperators = false,
  ...rest
}: AmountTextInputProps) {
  const [inner, setInner] = useState(defaultValue);
  const shown = value ?? inner;
  const inputRef = useRef<HTMLInputElement>(null);
  // Position du curseur, en caractères bruts, à rétablir après le reformatage.
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    const raw = pendingCaret.current;
    if (!el || raw === null) return;
    pendingCaret.current = null;
    if (document.activeElement !== el) return;
    const at = formatExpressionForDisplay(rawFromDisplay(shown)).toDisplay[raw] ?? shown.length;
    el.setSelectionRange(at, at);
  }, [shown]);

  return (
    <input
      {...rest}
      ref={inputRef}
      inputMode={rest.inputMode ?? "decimal"}
      value={shown}
      onChange={(event) => {
        const el = event.currentTarget;
        const clean = sanitizeAmountDisplay(el.value, el.selectionStart ?? el.value.length, allowOperators);
        const display = formatExpressionForDisplay(rawFromDisplay(clean.text)).text;
        pendingCaret.current = rawIndexFromDisplay(clean.text, clean.cursor);
        setInner(display);
        onValueChange?.(display);
      }}
    />
  );
}
