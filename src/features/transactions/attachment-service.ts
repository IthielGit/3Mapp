import { db as defaultDb, type AppDatabase } from "../../db/database";
import { createRepository } from "../../db/repositories";
import { attachmentSchema } from "../../db/entities";
import { compressImage } from "../../lib/image";

const MAX_RAW_BYTES = 15 * 1024 * 1024;

/** Ajoute une pièce jointe (image compressée) et retourne son id. */
export async function addAttachment(
  file: File,
  database: AppDatabase = defaultDb,
): Promise<string> {
  if (file.size > MAX_RAW_BYTES) throw new Error("Fichier trop volumineux (15 Mo maximum)");
  const blob = await compressImage(file);
  const record = await createRepository(database.attachments, attachmentSchema).create({
    blob,
    mime: blob.type || file.type,
    name: file.name,
    size: blob.size,
  });
  return record.id;
}

export async function removeAttachment(
  id: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.attachments.delete(id);
}
