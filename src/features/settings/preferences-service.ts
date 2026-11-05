import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import { settingsSchema, type Settings } from "../../db/entities";

/** Champs modifiables depuis l'écran Paramètres. */
export type PreferencePatch = Partial<
  Pick<
    Settings,
    | "language"
    | "weekStartDay"
    | "monthStartDay"
    | "payOnFriday"
    | "payIncomeCategoryId"
    | "payMode"
    | "keypadZeros"
    | "ignoreFutureBalance"
    | "reminderEnabled"
    | "reminderTime"
    | "lastReminderDay"
  >
>;

/** Applique des préférences aux réglages existants, en validant le résultat. */
export async function updatePreferences(
  patch: PreferencePatch,
  database: AppDatabase = defaultDb,
  now: Date = new Date(),
): Promise<Settings> {
  const current = await database.settings.toCollection().first();
  if (!current) throw new RuleError("Réglages introuvables : terminez l’onboarding");
  const next = settingsSchema.parse({ ...current, ...patch, updatedAt: now.toISOString() });
  await database.settings.put(next);
  return next;
}
