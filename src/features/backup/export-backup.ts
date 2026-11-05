import { db as defaultDb, type AppDatabase } from "../../db/database";
import { downloadBlob } from "../../lib/download";
import { backupFileName, createBackup, markBackupDone, serializeBackup } from "./backup-service";

/**
 * Télécharge une sauvegarde non chiffrée de toutes les données de cet appareil.
 * Sert à l'export RGPD (« mes données »), et de filet de sécurité avant tout effacement local.
 */
export async function downloadLocalBackup(database: AppDatabase = defaultDb, now: Date = new Date()): Promise<void> {
  const file = await createBackup(database, now);
  const text = await serializeBackup(file);
  downloadBlob(new Blob([text], { type: "application/json" }), backupFileName(now, false));
  await markBackupDone(database, now);
}
