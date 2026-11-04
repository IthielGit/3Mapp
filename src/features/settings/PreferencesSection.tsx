import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { db } from "../../db/database";
import { Field, inputClass } from "../../components/FormControls";
import { updatePreferences } from "./preferences-service";

/** Jours de la semaine, lundi d'abord. La valeur est celle de Date.getDay() (dimanche = 0). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Section « Préférences » de l'écran Paramètres (SPEC §5.16). */
export function PreferencesSection() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const [message, setMessage] = useState<string | undefined>();

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
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t("prefs.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-card border border-slate-200 p-4 dark:border-slate-700">
        <Field label={t("prefs.language")}>
          <select
            className={inputClass}
            value={settings.language === "en" ? "en" : "fr"}
            onChange={(e) => void changeLanguage(e.target.value as "fr" | "en")}
          >
            <option value="fr">{t("prefs.languageFr")}</option>
            <option value="en">{t("prefs.languageEn")}</option>
          </select>
        </Field>

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
            onChange={(e) => void change({ monthStartDay: Number(e.target.value) })}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {t("prefs.monthDay", { day })}
              </option>
            ))}
          </select>
        </Field>

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

        <label className="flex min-h-[44px] items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-brand-700"
            checked={settings.ignoreFutureBalance === true}
            onChange={(e) => void change({ ignoreFutureBalance: e.target.checked })}
          />
          <span className="flex flex-col">
            <span className="font-medium">{t("prefs.ignoreFuture")}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t("prefs.ignoreFutureHint")}
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <label className="flex min-h-[44px] items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-brand-700"
              checked={settings.reminderEnabled === true}
              onChange={(e) => void toggleReminder(e.target.checked)}
            />
            <span className="flex flex-col">
              <span className="font-medium">{t("prefs.reminder")}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
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
