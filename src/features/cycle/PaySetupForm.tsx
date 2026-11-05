import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { inputClass } from "../../components/FormControls";
import type { PayMode } from "../../db/entities";

/** Réponse à la question de paie : jour fixe (avec revenu), revenus irréguliers, ou pas de paie à suivre. */
export type PayChoice =
  | { mode: "fixed"; day: number; categoryId?: string }
  | { mode: "irregular" }
  | { mode: "none" };

export interface PayCategoryOption {
  id: string;
  name: string;
}

interface PaySetupFormProps {
  /** « hero » : sur la carte teal de l'accueil ; « page » : sur fond clair (onboarding). */
  tone: "hero" | "page";
  /** Jour proposé par défaut. */
  monthStartDay: number;
  /** Revenus à choisir pour la paie fixe. Absent : pas de choix de revenu (onboarding, « Salaire » par défaut). */
  categories?: PayCategoryOption[];
  /** Enregistre le choix (bouton affiché seulement si `submitLabel` est donné). */
  onSave?: (choice: PayChoice) => Promise<void>;
  submitLabel?: string;
  /** Prévient le parent à chaque changement ; null tant que la réponse est incomplète. */
  onChange?: (choice: PayChoice | null) => void;
  children?: ReactNode;
}

const PAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const TONES = {
  hero: {
    form: "flex flex-col gap-3 rounded-2xl bg-white/15 p-3 text-sm text-white",
    title: "font-semibold text-white",
    label: "text-xs font-medium text-white",
    hint: "text-xs text-white",
    select:
      "min-h-[44px] w-full rounded-xl bg-white px-3 text-base font-medium text-ink [color-scheme:light] outline-none focus:bg-stone-100",
    option:
      "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl bg-white/10 px-3 text-white has-[:checked]:bg-white has-[:checked]:font-semibold has-[:checked]:text-brand-900",
    submit: "min-h-[44px] rounded-xl bg-white font-semibold text-brand-900 disabled:bg-white/25 disabled:text-teal-50",
    link: "inline-flex min-h-[44px] items-center text-white underline",
  },
  page: {
    form: "flex flex-col gap-4",
    title: "text-base font-semibold text-ink dark:text-fg",
    label: "text-sm font-medium text-ink dark:text-fg",
    hint: "text-sm text-stone-600 dark:text-muted",
    select: inputClass,
    option:
      "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 text-ink has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 dark:border-white/15 dark:text-fg dark:has-[:checked]:border-brand-dark",
    submit:
      "min-h-[44px] rounded-xl bg-brand-700 font-semibold text-white disabled:opacity-50 dark:bg-brand-dark dark:text-ink",
    link: "inline-flex min-h-[44px] items-center text-brand-700 underline dark:text-brand-dark",
  },
} as const;

interface Draft {
  mode?: PayMode;
  day: number;
  categoryId: string;
}

/** Réponse complète, ou null tant qu'il manque une information (jour fixe sans revenu choisi). */
function toChoice(draft: Draft, needsCategory: boolean): PayChoice | null {
  if (draft.mode === undefined) return null;
  if (draft.mode !== "fixed") return { mode: draft.mode };
  if (needsCategory && draft.categoryId === "") return null;
  return { mode: "fixed", day: draft.day, ...(draft.categoryId ? { categoryId: draft.categoryId } : {}) };
}

/**
 * Question de paie : trois réponses. Partagée par l'accueil et l'onboarding, pour que le choix
 * et ses textes restent identiques.
 */
export function PaySetupForm({
  tone,
  monthStartDay,
  categories,
  onSave,
  submitLabel,
  onChange,
  children,
}: PaySetupFormProps) {
  const { t } = useTranslation();
  const groupId = useId();
  const style = TONES[tone];
  const needsCategory = categories !== undefined;
  const [draft, setDraft] = useState<Draft>({ day: monthStartDay, categoryId: "" });
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange?.(toChoice(next, needsCategory));
  }

  const choice = toChoice(draft, needsCategory);
  const options: { value: PayMode; label: string }[] = [
    { value: "fixed", label: t("cycle.payModeFixed") },
    { value: "irregular", label: t("cycle.payModeIrregular") },
    { value: "none", label: t("cycle.payModeNone") },
  ];
  const hint =
    draft.mode === "fixed"
      ? t("cycle.paySetupHint")
      : draft.mode === "irregular"
        ? t("cycle.payHintIrregular")
        : draft.mode === "none"
          ? t("cycle.payHintNone")
          : undefined;

  return (
    <form
      className={style.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (!onSave || !choice || saving) return;
        setSaving(true);
        void onSave(choice).finally(() => setSaving(false));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className={style.title}>{t("cycle.paySetupTitle")}</legend>
        {options.map((o) => (
          <label key={o.value} className={style.option}>
            <input
              type="radio"
              name={`${groupId}-pay`}
              value={o.value}
              checked={draft.mode === o.value}
              onChange={() => update({ mode: o.value })}
              className="h-5 w-5 accent-brand-700"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>

      {draft.mode === "fixed" ? (
        <div className={needsCategory ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
          <label className={`flex flex-col gap-1 ${style.label}`}>
            {t("cycle.paySetupDay")}
            <select className={style.select} value={draft.day} onChange={(e) => update({ day: Number(e.target.value) })}>
              {PAY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {categories ? (
            <label className={`flex flex-col gap-1 ${style.label}`}>
              {t("cycle.paySetupCategory")}
              <select
                className={style.select}
                value={draft.categoryId}
                onChange={(e) => update({ categoryId: e.target.value })}
              >
                <option value="">{t("cycle.paySetupPick")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {draft.mode === "fixed" && categories && categories.length === 0 ? (
        <Link to="/plus/categories/new" className={style.link}>
          {t("cycle.paySetupNoCategory")}
        </Link>
      ) : null}

      {hint ? <p className={style.hint}>{hint}</p> : null}

      {children}

      {onSave && submitLabel ? (
        <button type="submit" disabled={!choice || saving} className={style.submit}>
          {submitLabel}
        </button>
      ) : null}
    </form>
  );
}
