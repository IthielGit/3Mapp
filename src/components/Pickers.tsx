const ICON_CHOICES = [
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
  "#0f766e",
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
    <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-2">
      {ICON_CHOICES.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          onClick={() => onChange(icon)}
          className={`flex min-h-[44px] items-center justify-center rounded-lg border text-xl ${
            value === icon
              ? "border-brand-700 bg-brand-50 dark:bg-raised"
              : "border-slate-200 dark:border-slate-700"
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
            value === color ? "border-slate-900 dark:border-white" : "border-transparent"
          }`}
        />
      ))}
    </div>
  );
}
