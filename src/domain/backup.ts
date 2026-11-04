/** Rappel de sauvegarde (SPEC §5.14) : fonction pure, sans accès à la base. */

export const BACKUP_REMINDER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupReminder = "none" | "never" | "stale";

/**
 * - pas de données : aucun rappel (rien à sauvegarder) ;
 * - données mais jamais de sauvegarde : « never » ;
 * - dernière sauvegarde plus vieille que 7 jours : « stale » ;
 * - sinon : « none ».
 */
export function backupReminder(
  lastBackupAt: string | undefined,
  now: Date,
  hasData: boolean,
): BackupReminder {
  if (!hasData) return "none";
  if (!lastBackupAt) return "never";
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return "never";
  return now.getTime() - last > BACKUP_REMINDER_DAYS * DAY_MS ? "stale" : "none";
}
