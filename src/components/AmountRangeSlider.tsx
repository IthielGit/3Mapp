import "./amount-range.css";
import { useId } from "react";

interface AmountRangeSliderProps {
  label: string;
  /** Montants existants, triés croissant. Le curseur ne propose que ces valeurs. */
  options: number[];
  /** Borne basse choisie ; undefined = pas de minimum. */
  min: number | undefined;
  /** Borne haute choisie ; undefined = pas de maximum. */
  max: number | undefined;
  format: (value: number) => string;
  anyLabel: string;
  onChange: (min: number | undefined, max: number | undefined) => void;
}

/**
 * Fourchette à deux poignées sur des montants existants. Chaque poignée est un <input type="range"> :
 * clavier, lecteur d'écran et tactile fonctionnent sans code supplémentaire.
 */
export function AmountRangeSlider({
  label,
  options,
  min,
  max,
  format,
  anyLabel,
  onChange,
}: AmountRangeSliderProps) {
  const id = useId();
  if (options.length < 2) return null;

  const last = options.length - 1;
  const low =
    min === undefined
      ? 0
      : Math.max(
          0,
          options.findIndex((v) => v >= min),
        );
  const highAbove = max === undefined ? -1 : options.findIndex((v) => v > max);
  const high = highAbove === -1 ? last : Math.max(low, highAbove - 1);

  // Pourcentage de la course utile : les poignées ont une demi-largeur de marge de chaque côté.
  const pct = (index: number) => `calc(12px + (100% - 24px) * ${index / last})`;

  function setLow(index: number) {
    const next = Math.min(index, high);
    onChange(next === 0 ? undefined : options[next], max);
  }

  function setHigh(index: number) {
    const next = Math.max(index, low);
    onChange(min, next === last ? undefined : options[next]);
  }

  const lowText = min === undefined ? anyLabel : format(options[low] ?? options[0] ?? 0);
  const highText = max === undefined ? anyLabel : format(options[high] ?? options[last] ?? 0);

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <div className="relative h-[44px]">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-300 dark:bg-white/15" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-600"
          style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }}
        />
        <input
          type="range"
          className="amount-range"
          min={0}
          max={last}
          step={1}
          value={low}
          aria-labelledby={`${id}-label`}
          aria-valuetext={lowText}
          onChange={(e) => setLow(Number(e.target.value))}
        />
        <input
          type="range"
          className="amount-range"
          min={0}
          max={last}
          step={1}
          value={high}
          aria-labelledby={`${id}-label`}
          aria-valuetext={highText}
          onChange={(e) => setHigh(Number(e.target.value))}
        />
      </div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-medium text-ink dark:text-fg">{lowText}</span>
        <span className="font-medium text-ink dark:text-fg">{highText}</span>
      </div>
    </div>
  );
}
