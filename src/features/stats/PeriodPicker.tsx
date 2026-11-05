import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { buttonSecondary, inputClass } from "../../components/FormControls";
import type { Period, PeriodKind } from "../../domain/period";
import type { PeriodState } from "./period-state";

const KINDS: PeriodKind[] = ["day", "week", "month", "year", "custom"];

interface PeriodPickerProps {
  state: PeriodState;
  period: Period;
  onChange: (state: PeriodState) => void;
  onShift: (direction: -1 | 1) => void;
}

export function PeriodPicker({ state, period, onChange, onShift }: PeriodPickerProps) {
  const { t } = useTranslation();
  const lastDay = new Date(period.to.getTime() - 1);

  return (
    <section className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t("period.label")}
        className="grid grid-cols-5 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-raised"
      >
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={state.kind === kind}
            onClick={() => onChange({ kind, anchor: new Date(), custom: undefined })}
            className={`min-h-[44px] rounded-md text-sm font-medium ${state.kind === kind ? "bg-white shadow dark:bg-fg dark:text-ink" : ""}`}
          >
            {t(`period.kinds.${kind}`)}
          </button>
        ))}
      </div>

      {state.kind === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label={t("period.from")}
            className={inputClass}
            value={format(period.from, "yyyy-MM-dd")}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              const from = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
              onChange({ kind: "custom", anchor: from, custom: { from, to: period.to } });
            }}
          />
          <input
            type="date"
            aria-label={t("period.to")}
            className={inputClass}
            value={format(lastDay, "yyyy-MM-dd")}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              const to = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1);
              onChange({ kind: "custom", anchor: period.from, custom: { from: period.from, to } });
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={buttonSecondary}
            aria-label={t("period.previous")}
            onClick={() => onShift(-1)}
          >
            ←
          </button>
          <span className="text-center text-sm font-medium">{periodLabel(period)}</span>
          <button
            type="button"
            className={buttonSecondary}
            aria-label={t("period.next")}
            onClick={() => onShift(1)}
          >
            →
          </button>
        </div>
      )}
    </section>
  );
}

export function periodLabel(period: Period): string {
  const last = new Date(period.to.getTime() - 1);
  return `${format(period.from, "d MMM yyyy", { locale: fr })} – ${format(last, "d MMM yyyy", { locale: fr })}`;
}
