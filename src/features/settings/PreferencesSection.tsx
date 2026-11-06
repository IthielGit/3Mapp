import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import i18n from "../../i18n";
import { db } from "../../db/database";
import { Field, inputClass } from "../../components/FormControls";
import { accountingMonth } from "../../domain/period";
import { byName } from "../../lib/compare";
import { updatePreferences } from "./preferences-service";
import { askConfirm } from "../../components/confirm-service";
import { useTheme } from "../../lib/theme-context";

/** Jours de la semaine, lundi d'abord. La valeur est celle de Date.getDay() (dimanche = 0). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Section « Préférences » de l'écran Paramètres (SPEC §5.16). */
export function PreferencesSection() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const allCategories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [message, setMessage] = useState<string | undefined>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!settings) return null;

  const weekdays = t("prefs.weekdays", { returnObjects: true }) as string[];

  async function change(patch: Parameters<typeof updatePreferences>[0]) {
    setMessage(undefined);
    try {
      await updatePreferences(patch);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  async function changeMonthStart(day: number) {
    if (day === settings?.monthStartDay) return;
    // Le cycle est calculé à la lecture : changer le jour recalcule aussi les cycles passés.
    if (!(await askConfirm({ message: t("prefs.monthStartConfirm"), danger: false }))) return;
    await change({ monthStartDay: day });
  }

  const locale = i18n.language.startsWith("en") ? enUS : fr;
  const payOnFriday = settings.payOnFriday !== false;
  const cycle = accountingMonth(new Date(), settings.monthStartDay, payOnFriday);
  const incomeCategories = allCategories
    .filter((c) => c.kind === "income" && !c.archived)
    .sort(byName);
  const cycleLast = new Date(cycle.to.getTime() - 1);

  async function changeLanguage(language: "fr" | "en") {
    await change({ language });
    await i18n.changeLanguage(language);
  }

  async function toggleReminder(enabled: boolean) {
    setMessage(undefined);
    if (!enabled) {
      await change({ reminderEnabled: false });
      return;
    }
    if (typeof Notification === "undefined") {
      setMessage(t("prefs.reminderUnsupported"));
      return;
    }
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      setMessage(t("prefs.reminderDenied"));
      return;
    }
    await change({ reminderEnabled: true, reminderTime: settings?.reminderTime ?? "20:00" });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="px-1 text-sm font-semibold text-neutral-600 dark:text-muted">
        {t("prefs.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-card border border-neutral-200 p-4 dark:border-white/15">
        <Field label={t("prefs.language")}>
          <select
            className={inputClass}
            value={settings.language}
            onChange={(e) => void changeLanguage(e.target.value as "fr" | "en")}
          >
            <option value="fr">{t("prefs.languageFr")}</option>
            <option value="en">{t("prefs.languageEn")}</option>
          </select>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("pages.more.theme")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
              <label
                key={mode}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 text-sm font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 ${
                  theme === mode
                    ? "border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-dark dark:bg-brand-900 dark:text-brand-100"
                    : "border-neutral-300 text-ink dark:border-white/15 dark:text-fg"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={mode}
                  checked={theme === mode}
                  onChange={() => setTheme(mode)}
                  className="sr-only"
                />
                {t(
                  mode === "system"
                    ? "pages.more.themeSystem"
                    : mode === "light"
                      ? "pages.more.themeLight"
                      : "pages.more.themeDark",
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t("prefs.weekStart")}>
          <select
            className={inputClass}
            value={settings.weekStartDay}
            onChange={(e) => void change({ weekStartDay: Number(e.target.value) })}
          >
            {WEEK_ORDER.map((value) => (
              <option key={value} value={value}>
                {weekdays[(value + 6) % 7]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("prefs.monthStart")}>
          <select
            className={inputClass}
            value={settings.monthStartDay}
            onChange={(e) => void changeMonthStart(Number(e.target.value))}
          >
            {MONTH_DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </Field>
        <p className="-mt-2 text-sm text-neutral-600 dark:text-muted" aria-live="polite">
          {t("prefs.monthStartPreview", {
            from: format(cycle.from, "d MMM", { locale }),
            to: format(cycleLast, "d MMM", { locale }),
          })}
        </p>

        {settings.monthStartDay !== 1 ? (
          <label className="flex min-h-[44px] items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-brand-600"
              checked={payOnFriday}
              onChange={(e) => void change({ payOnFriday: e.target.checked })}
            />
            <span className="flex flex-col">
              <span className="font-medium">{t("prefs.payOnFriday")}</span>
              <span className="text-sm text-neutral-600 dark:text-muted">
                {t("prefs.payOnFridayHint")}
              </span>
            </span>
          </label>
        ) : null}

        <Field label={t("prefs.payIncome")}>
          <select
            className={inputClass}
            value={settings.payIncomeCategoryId ?? ""}
            onChange={(e) =>
              void change(
                e.target.value === ""
                  ? { payIncomeCategoryId: undefined }
                  : { payIncomeCategoryId: e.target.value, payMode: "fixed" },
              )
            }
          >
            <option value="">{t("prefs.payIncomeNone")}</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="-mt-2 text-sm text-neutral-600 dark:text-muted">{t("prefs.payIncomeHint")}</p>

        {/* Contenu monté seulement quand la section est ouverte : replié, rien n'est atteignable au clavier ni lu. */}
        <details
          className="group rounded-xl border border-neutral-200 p-3 dark:border-white/15"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        >
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-medium focus-visible:outline-2 focus-visible:outline-brand-600">
            {t("prefs.advanced")}
            <span aria-hidden="true" className="text-xl text-neutral-600 transition-transform duration-200 ease-out-strong group-open:rotate-90 motion-reduce:transition-none dark:text-muted">
              ›
            </span>
          </summary>
          {advancedOpen ? (
          <div className="mt-3 flex flex-col gap-4">
            <Field label={t("prefs.keypadZeros")}>
              <select
                className={inputClass}
                value={settings.keypadZeros ?? 3}
                onChange={(e) => void change({ keypadZeros: Number(e.target.value) as 2 | 3 })}
              >
                <option value={2}>00</option>
                <option value={3}>000</option>
              </select>
            </Field>
            <p className="-mt-2 text-sm text-neutral-600 dark:text-muted">{t("prefs.keypadZerosHint")}</p>

            <label className="flex min-h-[44px] items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-brand-600"
                checked={settings.ignoreFutureBalance === true}
                onChange={(e) => void change({ ignoreFutureBalance: e.target.checked })}
              />
              <span className="flex flex-col">
                <span className="font-medium">{t("prefs.ignoreFuture")}</span>
                <span className="text-sm text-neutral-600 dark:text-muted">
                  {t("prefs.ignoreFutureHint")}
                </span>
              </span>
            </label>
          </div>
          ) : null}
        </details>

        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-white/15">
          <label className="flex min-h-[44px] items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-brand-600"
              checked={settings.reminderEnabled === true}
              onChange={(e) => void toggleReminder(e.target.checked)}
            />
            <span className="flex flex-col">
              <span className="font-medium">{t("prefs.reminder")}</span>
              <span className="text-sm text-neutral-600 dark:text-muted">
                {t("prefs.reminderHint")}
              </span>
            </span>
          </label>
          {settings.reminderEnabled ? (
            <Field label={t("prefs.reminderTime")}>
              <input
                type="time"
                className={inputClass}
                value={settings.reminderTime ?? "20:00"}
                onChange={(e) => void change({ reminderTime: e.target.value })}
              />
            </Field>
          ) : null}
        </div>

        {message ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
