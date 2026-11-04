import { useEffect } from "react";
import { db } from "../../db/database";
import i18n from "../../i18n";
import { localDayKey, reminderDue } from "../../domain/reminder";
import { updatePreferences } from "./preferences-service";

/**
 * Affiche le rappel via le service worker (fonctionne sur téléphone), ou une notification
 * directe à défaut. Ne fait rien si la permission n'est pas accordée.
 */
async function showReminder(title: string, body: string): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration) {
    await registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "daily-reminder",
    });
    return;
  }
  new Notification(title, { body, tag: "daily-reminder" });
}

/** Une passe : langue appliquée, rappel affiché si dû. */
async function runPass(): Promise<void> {
  const settings = await db.settings.toCollection().first();
  if (!settings) return;

  if (settings.language !== i18n.language) {
    await i18n.changeLanguage(settings.language);
  }

  const now = new Date();
  const due = reminderDue(
    {
      enabled: settings.reminderEnabled === true,
      time: settings.reminderTime,
      lastDay: settings.lastReminderDay,
    },
    now,
  );
  if (!due) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  await showReminder(i18n.t("prefs.reminderTitle"), i18n.t("prefs.reminderBody"));
  await updatePreferences({ lastReminderDay: localDayKey(now) }, db, now);
}

/**
 * Préférences de l'app, appliquées à l'ouverture et tant que l'app reste ouverte :
 * langue choisie dans Paramètres, et rappel quotidien de saisie (une fois par jour).
 */
export function useAppPreferences(): void {
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void runPass().catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
}
