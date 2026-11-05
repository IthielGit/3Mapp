import { format } from "date-fns";
import { z } from "zod";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import { attachmentSchema, settingsSchema, type Attachment } from "../../db/entities";
import { fromBase64, toBase64 } from "../../lib/base64";
import { isSyncTracking } from "../../db/sync-tracking";
import {
  attachmentFileSchema,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileSchema,
  decryptEnvelope,
  encryptedEnvelopeSchema,
  encryptText,
  ENCRYPTED_FORMAT,
  MIN_PASSWORD_LENGTH,
  TABLE_NAMES,
  TABLE_SCHEMAS,
  type BackupFile,
  type StoredRecord,
  type TableName,
} from "./backup-format";

export type RestoreMode = "merge" | "replace";

/** Contenu d'une sauvegarde après validation : prêt à être écrit, rien n'a encore été modifié. */
export interface PreparedRestore {
  exportedAt: string;
  records: Record<TableName, StoredRecord[]>;
  count: number;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new RuleError("Fichier illisible : ce n'est pas une sauvegarde JSON");
  }
}

/** Vrai si le fichier est une sauvegarde chiffrée (il faudra un mot de passe). */
export function isEncryptedBackup(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { format?: unknown }).format === ENCRYPTED_FORMAT
    );
  } catch {
    return false;
  }
}

/** Lit toutes les tables et encode les pièces jointes en base64. */
export async function createBackup(
  database: AppDatabase = defaultDb,
  now: Date = new Date(),
): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    if (name === "attachments") continue;
    tables[name] = await database.table(name).toArray();
  }
  const attachments = await database.attachments.toArray();
  tables.attachments = await Promise.all(attachments.map(encodeAttachment));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    tables,
  };
}

/** Octets d'un Blob. Repli sur FileReader pour les environnements sans Blob.arrayBuffer(). */
export function blobToBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Lecture de la pièce jointe impossible"));
    reader.readAsArrayBuffer(blob);
  });
}

async function encodeAttachment(attachment: Attachment): Promise<unknown> {
  const { blob, ...meta } = attachment;
  return { ...meta, data: toBase64(await blobToBytes(blob)) };
}

/** Texte du fichier : JSON en clair, ou enveloppe chiffrée si un mot de passe est donné. */
export async function serializeBackup(file: BackupFile, password?: string): Promise<string> {
  const json = JSON.stringify(file);
  if (!password) return json;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new RuleError(
      `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères`,
    );
  }
  return encryptText(json, password);
}

function parseBackupFile(value: unknown): BackupFile {
  const result = backupFileSchema.safeParse(value);
  if (!result.success) {
    throw new RuleError("Ce fichier n'est pas une sauvegarde Money Manager");
  }
  for (const name of TABLE_NAMES) {
    if (!(name in result.data.tables)) {
      throw new RuleError(`Sauvegarde incomplète : la table « ${name} » est absente`);
    }
  }
  return result.data;
}

/**
 * Lit le texte d'une sauvegarde (en clair ou chiffrée). Ne modifie rien.
 * Pour un fichier chiffré, `password` est obligatoire.
 */
export async function readBackupText(text: string, password?: string): Promise<BackupFile> {
  const parsed = parseJson(text);
  if (!isEncryptedBackup(text)) return parseBackupFile(parsed);

  if (!password) throw new RuleError("Mot de passe requis pour ce fichier chiffré");
  const envelope = encryptedEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) throw new RuleError("Fichier chiffré invalide");
  const plain = await decryptEnvelope(envelope.data, password);
  return parseBackupFile(parseJson(plain));
}

function parseRecord(name: TableName, raw: unknown): StoredRecord {
  try {
    if (name === "attachments") {
      const { data, mime, ...meta } = attachmentFileSchema.parse(raw);
      const blob = new Blob([fromBase64(data)], { type: mime });
      return attachmentSchema.parse({ ...meta, mime, blob });
    }
    return TABLE_SCHEMAS[name].parse(raw);
  } catch (err) {
    const detail = err instanceof z.ZodError ? "données incohérentes" : "lecture impossible";
    throw new RuleError(`Sauvegarde invalide (table « ${name} » : ${detail})`);
  }
}

/**
 * Valide chaque enregistrement avec son schéma. Si un seul est invalide (ex. montant décimal),
 * toute la restauration est refusée avant la première écriture.
 */
export function prepareRestore(file: BackupFile): PreparedRestore {
  const records = {} as Record<TableName, StoredRecord[]>;
  let count = 0;
  for (const name of TABLE_NAMES) {
    const rows = (file.tables[name] ?? []).map((raw) => parseRecord(name, raw));
    records[name] = rows;
    count += rows.length;
  }
  return { exportedAt: file.exportedAt, records, count };
}

/**
 * Écrit la sauvegarde dans une seule transaction.
 * - « replace » : vide toutes les tables puis écrit la sauvegarde ;
 * - « merge » : ajoute les enregistrements absents, remplace un enregistrement local seulement
 *   si la sauvegarde est plus récente. Les réglages locaux sont conservés.
 * Retourne le nombre d'enregistrements écrits.
 */
export async function restoreBackup(
  prepared: PreparedRestore,
  mode: RestoreMode,
  database: AppDatabase = defaultDb,
): Promise<number> {
  let written = 0;
  // Synchro active + remplacement : les versions restaurées doivent l'emporter sur celles du compte (le plus récent gagne).
  const stamp = mode === "replace" && isSyncTracking() ? new Date().toISOString() : undefined;
  await database.transaction("rw", database.tables, async () => {
    if (mode === "replace") {
      for (const table of database.tables) await table.clear();
    }
    for (const name of TABLE_NAMES) {
      const table = database.table(name);
      // Il n'existe qu'un seul jeu de réglages : en fusion, on garde ceux de l'appareil.
      if (mode === "merge" && name === "settings" && (await table.count()) > 0) continue;
      for (const record of prepared.records[name]) {
        if (mode === "merge") {
          const local = (await table.get(record.id)) as StoredRecord | undefined;
          if (local && local.updatedAt >= record.updatedAt) continue;
        }
        await table.put(stamp ? { ...record, updatedAt: stamp } : record);
        written++;
      }
    }
  });
  return written;
}

/** Enregistre la date de la dernière sauvegarde (rappel SPEC §5.14). */
export async function markBackupDone(
  database: AppDatabase = defaultDb,
  now: Date = new Date(),
): Promise<void> {
  const current = await database.settings.toCollection().first();
  if (!current) return;
  const iso = now.toISOString();
  await database.settings.put(
    settingsSchema.parse({ ...current, lastBackupAt: iso, updatedAt: iso }),
  );
}

/** Nom du fichier téléchargé, par exemple money-manager-2026-11-04.json. */
export function backupFileName(now: Date, encrypted: boolean): string {
  return `money-manager-${format(now, "yyyy-MM-dd")}${encrypted ? "-chiffre" : ""}.json`;
}
