import { z } from "zod";
import { RuleError } from "../../db/errors";
import {
  attachmentSchema,
  budgetSchema,
  categorySchema,
  currencySchema,
  debtPaymentSchema,
  debtSchema,
  exchangeRateSchema,
  goalSchema,
  goalTransactionSchema,
  reconciliationSchema,
  recurringSchema,
  settingsSchema,
  subcategorySchema,
  templateSchema,
  transactionSchema,
  walletSchema,
} from "../../db/entities";
import { fromBase64, toBase64 } from "../../lib/base64";
import { PBKDF2_ITERATIONS } from "../../lib/pin";

/**
 * Format de sauvegarde (SPEC §5.14). Deux enveloppes possibles :
 * - sauvegarde en clair : JSON `money-manager/backup` ;
 * - sauvegarde chiffrée : JSON `money-manager/encrypted-backup` (AES-GCM, clé dérivée par PBKDF2).
 */
export const BACKUP_FORMAT = "money-manager/backup";
export const ENCRYPTED_FORMAT = "money-manager/encrypted-backup";
export const BACKUP_VERSION = 1;
export const MIN_PASSWORD_LENGTH = 8;

/** Toutes les tables Dexie, dans l'ordre d'écriture. Une table absente du fichier est refusée. */
export const TABLE_NAMES = [
  "settings",
  "currencies",
  "exchangeRates",
  "wallets",
  "categories",
  "subcategories",
  "transactions",
  "templates",
  "recurring",
  "budgets",
  "goals",
  "goalTransactions",
  "debts",
  "debtPayments",
  "attachments",
  "reconciliations",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

/** Enregistrement minimal commun à toutes les tables (id et date de mise à jour). */
export interface StoredRecord {
  id: string;
  updatedAt: string;
}

/** Schéma de validation de chaque table, utilisé avant toute écriture. */
export const TABLE_SCHEMAS: Record<TableName, z.ZodType<StoredRecord, unknown>> = {
  settings: settingsSchema,
  currencies: currencySchema,
  exchangeRates: exchangeRateSchema,
  wallets: walletSchema,
  categories: categorySchema,
  subcategories: subcategorySchema,
  transactions: transactionSchema,
  templates: templateSchema,
  recurring: recurringSchema,
  budgets: budgetSchema,
  goals: goalSchema,
  goalTransactions: goalTransactionSchema,
  debts: debtSchema,
  debtPayments: debtPaymentSchema,
  attachments: attachmentSchema,
  reconciliations: reconciliationSchema,
};

/** Pièce jointe dans le fichier : le contenu binaire est encodé en base64 dans `data`. */
export const attachmentFileSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archived: z.boolean().optional(),
  mime: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  data: z.string(),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  tables: z.record(z.string(), z.array(z.unknown())),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

export const encryptedEnvelopeSchema = z.object({
  format: z.literal(ENCRYPTED_FORMAT),
  version: z.literal(BACKUP_VERSION),
  kdf: z.object({
    name: z.literal("PBKDF2"),
    hash: z.literal("SHA-256"),
    iterations: z.number().int().min(100_000).max(10_000_000),
    salt: z.string(),
  }),
  cipher: z.object({
    name: z.literal("AES-GCM"),
    iv: z.string(),
  }),
  data: z.string(),
});

export type EncryptedEnvelope = z.infer<typeof encryptedEnvelopeSchema>;

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/** Chiffre le texte de la sauvegarde ; retourne l'enveloppe JSON (sel et IV aléatoires). */
export async function encryptText(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS, "encrypt");
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  const envelope: EncryptedEnvelope = {
    format: ENCRYPTED_FORMAT,
    version: BACKUP_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    data: toBase64(new Uint8Array(cipher)),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Déchiffre une enveloppe. Un mauvais mot de passe ou un fichier modifié échoue (GCM). */
export async function decryptEnvelope(
  envelope: EncryptedEnvelope,
  password: string,
): Promise<string> {
  const key = await deriveKey(
    password,
    fromBase64(envelope.kdf.salt),
    envelope.kdf.iterations,
    "decrypt",
  );
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.cipher.iv) },
      key,
      fromBase64(envelope.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new RuleError("Mot de passe incorrect ou fichier altéré");
  }
}
