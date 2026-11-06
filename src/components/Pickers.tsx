import { onRadioGroupKeyDown } from "./radio-keys";

const ICON_CHOICES: readonly string[] = [
  "🏦",
  "💵",
  "📱",
  "💳",
  "🐷",
  "💼",
  "🍽️",
  "🏠",
  "🚗",
  "💊",
  "🎓",
  "🎮",
  "👕",
  "👨‍👩‍👧",
  "📈",
  "📦",
  "🛒",
  "🎁",
  "💰",
  "⛽",
  "📚",
  "✈️",
] as const;

const COLOR_CHOICES = [
  "#0B7E9D",
  "#2563eb",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#475569",
] as const;

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  label: string;
}

export function IconPicker({ value, onChange, label }: IconPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onRadioGroupKeyDown} className="grid grid-cols-6 gap-2">
      {ICON_CHOICES.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={icon}
          tabIndex={value === icon || (!ICON_CHOICES.includes(value) && icon === ICON_CHOICES[0]) ? 0 : -1}
          onClick={() => onChange(icon)}
          className={`flex min-h-[44px] items-center justify-center rounded-lg border text-xl ${
            value === icon
              ? "border-brand-600 bg-brand-50 dark:bg-raised"
              : "border-neutral-200 dark:border-white/15"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
      {COLOR_CHOICES.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={`h-11 w-11 rounded-full border-4 ${
            value === color ? "border-neutral-900 dark:border-white" : "border-transparent"
          }`}
        />
      ))}
    </div>
  );
}
