import type { SupabaseClient } from "@supabase/supabase-js";
import type { Table } from "dexie";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import {
  SYNCED_TABLES,
  SYNC_STATE_ID,
  discardPending,
  endRemoteWrites,
  beginRemoteWrites,
  flushOutbox,
  nextSeq,
  setSyncTracking,
  type OutboxEntry,
  type SyncStateRow,
} from "../../db/sync-tracking";
import {
  SETTINGS_RECORD_ID,
  chunk,
  outboxKey,
  overlapSince,
  shouldApplyRemote,
  shouldApplyTombstone,
} from "../../domain/sync";
import type { TableName } from "../backup/backup-format";
import { decodeRecord, encodeRecord } from "./sync-records";

const PUSH_BATCH = 100;
const PULL_PAGE = 500;
const WRITE_BATCH = 500;
const EPOCH = "1970-01-01T00:00:00.000Z";

/** Erreur de synchro, classée pour l'affichage (jamais de message serveur brut dans l'interface). */
export type SyncErrorCode = "network" | "suspended" | "unknown";

export class SyncError extends Error {
  readonly code: SyncErrorCode;
  constructor(code: SyncErrorCode) {
    super(`sync:${code}`);
    this.name = "SyncError";
    this.code = code;
  }
}

export interface SyncReport {
  pushed: number;
  skipped: number;
  applied: number;
}

/** Ligne telle que renvoyée par la table serveur sync_records. */
interface RemoteRow {
  table_name: string;
  record_id: string;
  updated_at: string;
  deleted: boolean;
  data: Record<string, unknown> | null;
  changed_at: string;
}

interface StoredRecord {
  id: string;
  updatedAt: string;
}

interface PushRow {
  table_name: string;
  record_id: string;
  updated_at: string;
  deleted: boolean;
  data: Record<string, unknown> | null;
}

function classify(error: { code?: string; message?: string } | null): SyncError {
  const message = (error?.message ?? "").toLowerCase();
  if (error?.code === "42501" || message.includes("account suspended")) return new SyncError("suspended");
  if (message.includes("fetch") || message.includes("network")) return new SyncError("network");
  return new SyncError("unknown");
}

function remoteId(table: string, localId: string): string {
  return table === "settings" ? SETTINGS_RECORD_ID : localId;
}

async function getState(database: AppDatabase): Promise<SyncStateRow | undefined> {
  return database.syncState.get(SYNC_STATE_ID);
}

async function saveState(database: AppDatabase, patch: Partial<SyncStateRow>): Promise<void> {
  const current = await getState(database);
  await database.syncState.put({ enabled: false, ...current, ...patch, id: SYNC_STATE_ID });
}

/** Construit la ligne à envoyer pour une entrée de la file. `undefined` si rien ne doit partir. */
async function buildRow(database: AppDatabase, entry: OutboxEntry): Promise<PushRow | undefined> {
  const table = entry.table as TableName;
  if (!(SYNCED_TABLES as readonly string[]).includes(entry.table)) return undefined;
  const id = remoteId(entry.table, entry.recordId);
  const tombstone = (): PushRow | undefined =>
    table === "settings"
      ? undefined // Les réglages ne sont jamais supprimés à distance.
      : { table_name: entry.table, record_id: id, updated_at: entry.at, deleted: true, data: null };

  if (entry.op === "delete") return tombstone();
  const record = (await database.table(entry.table).get(entry.recordId)) as Record<string, unknown> | undefined;
  if (!record) return tombstone();
  const encoded = await encodeRecord(table, record);
  if (!encoded.ok) return undefined;
  return {
    table_name: entry.table,
    record_id: id,
    updated_at: String(record.updatedAt),
    deleted: false,
    data: encoded.data,
  };
}

/** Envoie la file par lots. Ne retire de la file que les entrées qui n'ont pas changé pendant l'envoi. */
async function pushOutbox(
  client: SupabaseClient,
  database: AppDatabase,
): Promise<{ pushed: number; skipped: number }> {
  let pushed = 0;
  let skipped = 0;
  for (;;) {
    const batch = await database.syncOutbox.orderBy("seq").limit(PUSH_BATCH).toArray();
    if (batch.length === 0) break;
    const rows: PushRow[] = [];
    for (const entry of batch) {
      const row = await buildRow(database, entry);
      if (row) rows.push(row);
      else skipped += 1;
    }
    if (rows.length > 0) {
      const { error } = await client.rpc("sync_push", { p_records: rows });
      if (error) throw classify(error);
      pushed += rows.length;
    }
    await database.transaction("rw", database.syncOutbox, async () => {
      for (const entry of batch) {
        const current = await database.syncOutbox.get(entry.key);
        if (current && current.seq === entry.seq) await database.syncOutbox.delete(entry.key);
      }
    });
    if (batch.length < PUSH_BATCH) break;
  }
  return { pushed, skipped };
}

interface Prepared {
  table: TableName;
  incomingId: string;
  kind: "put" | "delete";
  updatedAt: string;
  record?: StoredRecord & Record<string, unknown>;
}

/** Valide une page reçue avant toute écriture locale ; une donnée invalide est comptée et ignorée. */
async function prepareRows(rows: RemoteRow[]): Promise<{ prepared: Prepared[]; skipped: number }> {
  const prepared: Prepared[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!(SYNCED_TABLES as readonly string[]).includes(row.table_name)) {
      skipped += 1;
      continue;
    }
    const table = row.table_name as TableName;
    if (row.deleted) {
      if (table === "settings") {
        skipped += 1;
        continue;
      }
      prepared.push({ table, incomingId: row.record_id, kind: "delete", updatedAt: row.updated_at });
      continue;
    }
    const decoded = row.data ? await decodeRecord(table, row.data) : undefined;
    if (!decoded) {
      skipped += 1;
      continue;
    }
    prepared.push({
      table,
      incomingId: String(decoded.id),
      kind: "put",
      updatedAt: String(decoded.updatedAt),
      record: decoded as StoredRecord & Record<string, unknown>,
    });
  }
  return { prepared, skipped };
}

/**
 * Applique une page reçue dans une seule transaction locale.
 * Les écritures faites ici ne repartent pas vers le serveur (suivi suspendu pour leurs clés).
 */
async function applyPage(database: AppDatabase, rows: RemoteRow[]): Promise<{ applied: number; skipped: number }> {
  const { prepared, skipped: invalid } = await prepareRows(rows);
  let skipped = invalid;
  let applied = 0;
  if (prepared.length === 0) return { applied, skipped };

  // Réglages : l'identifiant local reste celui de l'appareil ; le distant n'écrase que les champs synchronisés.
  const localSettings = await database.settings.toCollection().first();
  const localIdFor = (p: Prepared): string =>
    p.table === "settings" && localSettings ? localSettings.id : p.incomingId;
  const keys = prepared.map((p) => outboxKey(p.table, localIdFor(p)));

  beginRemoteWrites(keys);
  try {
    await database.transaction("rw", database.tables, async () => {
      for (const p of prepared) {
        const localId = localIdFor(p);
        const table = database.table(p.table) as Table<StoredRecord, string>;
        const local = await table.get(localId);
        if (p.kind === "delete") {
          if (shouldApplyTombstone(local, p.updatedAt)) {
            await table.delete(localId);
            applied += 1;
          }
          continue;
        }
        // Une suppression locale non encore envoyée l'emporte sur une version distante qui la précède.
        const pendingDelete = await database.syncOutbox.get(outboxKey(p.table, localId));
        if (pendingDelete?.op === "delete") {
          skipped += 1;
          continue;
        }
        if (!p.record || !shouldApplyRemote(local, p.record.updatedAt)) continue;
        if (p.table === "settings" && local) {
          // Champs de l'appareil conservés : seuls les champs synchronisés viennent du distant.
          await table.put({ ...local, ...p.record, id: local.id } as StoredRecord);
        } else {
          await table.put({ ...p.record, id: localId } as StoredRecord);
        }
        applied += 1;
      }
    });
  } finally {
    endRemoteWrites(keys);
  }
  return { applied, skipped };
}

/** Lit les changements serveur par pages, à partir du curseur, et les applique. */
async function pullChanges(
  client: SupabaseClient,
  database: AppDatabase,
): Promise<{ applied: number; skipped: number }> {
  const state = await getState(database);
  let since = state?.cursor ? overlapSince(state.cursor) : EPOCH;
  let applied = 0;
  let skipped = 0;
  for (;;) {
    const { data, error } = await client
      .from("sync_records")
      .select("table_name,record_id,updated_at,deleted,data,changed_at")
      .gt("changed_at", since)
      .order("changed_at", { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw classify(error);
    const rows = (data ?? []) as RemoteRow[];
    if (rows.length === 0) break;
    const result = await applyPage(database, rows);
    applied += result.applied;
    skipped += result.skipped;
    const last = rows[rows.length - 1]?.changed_at;
    if (!last) break;
    await saveState(database, { cursor: last });
    since = last;
    if (rows.length < PULL_PAGE) break;
  }
  return { applied, skipped };
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Une synchronisation à la fois : les déclencheurs (retour réseau, modification, minuterie)
 * ne se chevauchent pas.
 */
export function runSync(
  client: SupabaseClient,
  database: AppDatabase = defaultDb,
): Promise<SyncReport> {
  const run = queue.then(() => runSyncOnce(client, database));
  queue = run.catch(() => undefined);
  return run;
}

async function runSyncOnce(client: SupabaseClient, database: AppDatabase): Promise<SyncReport> {
  const state = await getState(database);
  setSyncTracking(state?.enabled === true);
  if (!state?.enabled) return { pushed: 0, skipped: 0, applied: 0 };
  try {
    await flushOutbox(database);
    const pushed = await pushOutbox(client, database);
    const pulled = await pullChanges(client, database);
    await saveState(database, { lastSyncAt: new Date().toISOString(), lastError: undefined });
    return { pushed: pushed.pushed, skipped: pushed.skipped + pulled.skipped, applied: pulled.applied };
  } catch (error) {
    const code = error instanceof SyncError ? error.code : "unknown";
    await saveState(database, { lastError: code });
    throw error instanceof SyncError ? error : new SyncError("unknown");
  }
}

/** Nombre d'enregistrements locaux suivis (sans les réglages, qui comptent pour un seul). */
export async function countLocalRecords(database: AppDatabase = defaultDb): Promise<number> {
  let total = 0;
  for (const name of SYNCED_TABLES) {
    if (name === "settings") continue;
    total += await database.table(name).count();
  }
  return total;
}

/** Nombre d'enregistrements présents sur le compte (lignes visibles par RLS, donc uniquement les miennes). */
export async function countRemoteRecords(client: SupabaseClient): Promise<number> {
  const { count, error } = await client.from("sync_records").select("*", { count: "exact", head: true });
  if (error) throw classify(error);
  return count ?? 0;
}

/** Marque tous les enregistrements locaux comme à envoyer (fusion des deux côtés). */
async function enqueueAll(database: AppDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const name of SYNCED_TABLES) {
    const ids = (await database.table(name).toCollection().primaryKeys()).map(String);
    for (const batch of chunk(ids, WRITE_BATCH)) {
      const entries: OutboxEntry[] = batch.map((recordId) => ({
        key: outboxKey(name, recordId),
        table: name,
        recordId,
        op: "upsert",
        seq: nextSeq(),
        at: now,
      }));
      await database.syncOutbox.bulkPut(entries);
    }
  }
}

/**
 * Active la synchro sur cet appareil.
 * - « merge » : tout ce qui est local part vers le compte, puis les changements distants sont fusionnés.
 * - « remote » : les données locales synchronisées sont remplacées par celles du compte (réglages de l'appareil conservés).
 */
export async function enableSync(
  client: SupabaseClient,
  userId: string,
  mode: "merge" | "remote",
  database: AppDatabase = defaultDb,
): Promise<SyncReport> {
  if (mode === "merge") {
    await enqueueAll(database);
  } else {
    await database.transaction("rw", database.tables, async () => {
      for (const name of SYNCED_TABLES) {
        if (name === "settings") continue;
        await database.table(name).clear();
      }
      await database.syncOutbox.clear();
    });
  }
  await saveState(database, {
    enabled: true,
    userId,
    cursor: mode === "remote" ? undefined : (await getState(database))?.cursor,
    lastError: undefined,
  });
  setSyncTracking(true);
  return runSync(client, database);
}

/** Désactive la synchro : les données restent sur l'appareil, la file d'envoi est vidée. */
export async function disableSync(database: AppDatabase = defaultDb): Promise<void> {
  setSyncTracking(false);
  discardPending();
  await database.syncOutbox.clear();
  await saveState(database, { enabled: false, userId: undefined, cursor: undefined, lastError: undefined });
}

/** Nombre d'entrées en attente d'envoi (pour l'affichage). */
export function pendingCount(database: AppDatabase = defaultDb): Promise<number> {
  return database.syncOutbox.count();
}

export function readSyncState(database: AppDatabase = defaultDb): Promise<SyncStateRow | undefined> {
  return getState(database);
}
