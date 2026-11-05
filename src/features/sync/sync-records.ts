import { TABLE_SCHEMAS, type TableName } from "../backup/backup-format";
import { fromBase64, toBase64 } from "../../lib/base64";
import { stripDeviceFields } from "../../domain/sync";

/** Taille maximale d'une pièce jointe synchronisée (au-delà, elle reste locale et le statut le signale). */
export const MAX_SYNCED_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** Résultat du codage : `skipped` quand un enregistrement ne peut pas être envoyé (pièce jointe trop lourde). */
export type EncodedRecord =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: "tooLarge" | "missingBlob" };

/**
 * Prépare un enregistrement local pour l'envoi :
 * - réglages : sans les champs propres à l'appareil (PIN, biométrie…) ;
 * - pièces jointes : le binaire est encodé en base64 dans `blobBase64`.
 */
export async function encodeRecord(table: TableName, record: Record<string, unknown>): Promise<EncodedRecord> {
  if (table === "settings") {
    return { ok: true, data: stripDeviceFields(record) as Record<string, unknown> };
  }
  if (table === "attachments") {
    const { blob, ...rest } = record as { blob: Blob } & Record<string, unknown>;
    // Vérifie la capacité plutôt que la classe : un Blob relu d'IndexedDB peut venir d'un autre contexte.
    if (!blob || typeof blob.arrayBuffer !== "function") return { ok: false, reason: "missingBlob" };
    if (blob.size > MAX_SYNCED_ATTACHMENT_BYTES) return { ok: false, reason: "tooLarge" };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { ok: true, data: { ...rest, blobBase64: toBase64(bytes) } };
  }
  return { ok: true, data: record };
}

/**
 * Reconstruit un enregistrement reçu et le valide avec le schéma de sa table (même règle que la restauration).
 * Renvoie `undefined` si la donnée est invalide : elle n'est alors pas écrite.
 */
export async function decodeRecord(
  table: TableName,
  data: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  let candidate: Record<string, unknown> = data;
  if (table === "attachments") {
    const { blobBase64, ...rest } = data as { blobBase64?: unknown } & Record<string, unknown>;
    if (typeof blobBase64 !== "string") return undefined;
    const bytes = fromBase64(blobBase64);
    candidate = { ...rest, blob: new Blob([bytes], { type: typeof rest.mime === "string" ? rest.mime : "" }) };
  }
  const parsed = TABLE_SCHEMAS[table].safeParse(candidate);
  return parsed.success ? (parsed.data as unknown as Record<string, unknown>) : undefined;
}
