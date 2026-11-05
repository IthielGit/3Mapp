import Dexie from "dexie";
import type { AppDatabase } from "./database";
import { outboxKey } from "../domain/sync";

/** Tables suivies pour la synchronisation : toutes les tables de données (TABLE_NAMES, backup-format.ts). */
export const SYNCED_TABLES = [
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

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Un enregistrement modifié ou supprimé, en attente d'envoi. */
export interface OutboxEntry {
  key: string;
  table: string;
  recordId: string;
  op: "upsert" | "delete";
  /** Ordre d'arrivée : sert à ne retirer de la file que ce qui a été réellement envoyé. */
  seq: number;
  /** Instant de la modification locale (ISO) ; date de suppression pour une pierre tombale. */
  at: string;
}

export const SYNC_STATE_ID = "state";

/** État de la synchro sur cet appareil (une seule ligne). */
export interface SyncStateRow {
  id: typeof SYNC_STATE_ID;
  enabled: boolean;
  userId?: string;
  /** Dernier curseur serveur lu (changed_at de la dernière ligne reçue). */
  cursor?: string;
  lastSyncAt?: string;
  lastError?: string;
}

/** Suivi actif seulement quand la synchro est activée sur cet appareil. */
let tracking = false;

export function setSyncTracking(enabled: boolean): void {
  tracking = enabled;
}

export function isSyncTracking(): boolean {
  return tracking;
}

/**
 * Clés en cours d'application depuis le serveur : leurs écritures ne doivent pas repartir vers le serveur.
 */
const applying = new Set<string>();

export function beginRemoteWrites(keys: readonly string[]): void {
  for (const key of keys) applying.add(key);
}

export function endRemoteWrites(keys: readonly string[]): void {
  for (const key of keys) applying.delete(key);
}

let seqCounter = 0;

/** Numéro d'ordre croissant, même si plusieurs modifications tombent dans la même milliseconde. */
export function nextSeq(): number {
  seqCounter = (seqCounter + 1) % 1000;
  return Date.now() * 1000 + seqCounter;
}

/** Entrées en attente d'écriture dans la file (regroupées pour éviter une transaction par ligne). */
const pending = new Map<string, OutboxEntry>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

async function writePending(db: AppDatabase): Promise<void> {
  const entries = [...pending.values()];
  pending.clear();
  if (entries.length === 0) return;
  try {
    // Hors de la transaction de l'écriture d'origine : la file est une liste de « à vérifier », donc sans risque
    // si une entrée est redondante (l'envoi relit l'état réel de l'enregistrement).
    await Dexie.ignoreTransaction(() => db.table("syncOutbox").bulkPut(entries));
  } catch {
    // En cas d'échec, les entrées restent à écrire au prochain passage.
    for (const entry of entries) if (!pending.has(entry.key)) pending.set(entry.key, entry);
    scheduleFlush(db);
  }
}

function scheduleFlush(db: AppDatabase): void {
  if (flushTimer !== undefined) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void writePending(db);
  }, 20);
}

/** Écrit tout de suite la file en attente (avant un envoi, pour ne rien oublier). */
export async function flushOutbox(db: AppDatabase): Promise<void> {
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  await writePending(db);
}

function enqueue(db: AppDatabase, table: string, recordId: string, op: OutboxEntry["op"]): void {
  if (!tracking) return;
  const key = outboxKey(table, recordId);
  if (applying.has(key)) return;
  pending.set(key, { key, table, recordId, op, seq: nextSeq(), at: new Date().toISOString() });
  scheduleFlush(db);
}

/**
 * Relie les hooks Dexie : création, modification et suppression de chaque table suivie.
 * Les écritures de la file elle-même ne sont jamais suivies (la file n'est pas dans SYNCED_TABLES).
 */
export function installSyncTracking(db: AppDatabase): void {
  for (const name of SYNCED_TABLES) {
    const table = db.table(name);
    table.hook("creating", function (primKey) {
      enqueue(db, name, String(primKey), "upsert");
    });
    table.hook("updating", function (_modifications, primKey) {
      enqueue(db, name, String(primKey), "upsert");
      return undefined;
    });
    table.hook("deleting", function (primKey) {
      enqueue(db, name, String(primKey), "delete");
    });
  }
}

/** Abandonne les entrées encore en mémoire (désactivation de la synchro). */
export function discardPending(): void {
  pending.clear();
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
}
