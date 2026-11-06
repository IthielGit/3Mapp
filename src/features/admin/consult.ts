import type { SupabaseClient } from "@supabase/supabase-js";
import type { Table } from "dexie";
import { useSyncExternalStore } from "react";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { SYNCED_TABLES, setReadOnly, withTrustedWrites } from "../../db/sync-tracking";
import { prepareRows, disableSync, enableSync, pendingCount, type Prepared } from "../sync/sync-engine";
import { consultEnd, consultPull, consultStart, type ConsultRow } from "./admin-service";

/**
 * Consultation « voir comme un utilisateur » (lecture seule).
 *
 * Principe : la base locale reçoit les données du compte consulté, la synchro de l'administrateur est
 * arrêtée, et toute écriture locale est refusée (garde dans la base locale, voir sync-tracking.ts).
 * Fin de consultation : la base locale est vidée et la synchro de l'administrateur repart de son propre compte.
 *
 * Choix : les réglages de l'appareil (et les réglages synchronisés) ne sont pas chargés pendant la consultation.
 * Ils restent ceux de l'administrateur, pour ne jamais écraser ses réglages ni son code PIN.
 */

const MARKER_KEY = "fundora.consult";

/** Marque de consultation, gardée dans sessionStorage : elle disparaît avec l'onglet. */
export interface ConsultMarker {
  adminId: string;
  targetId: string;
  email: string;
}

export class ConsultError extends Error {
  readonly code: "unsynced";
  constructor(code: "unsynced") {
    super(`consult:${code}`);
    this.name = "ConsultError";
    this.code = code;
  }
}

function readMarker(): ConsultMarker | undefined {
  try {
    const raw = window.sessionStorage.getItem(MARKER_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<ConsultMarker>;
    if (typeof value.adminId === "string" && typeof value.targetId === "string" && typeof value.email === "string") {
      return { adminId: value.adminId, targetId: value.targetId, email: value.email };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeMarker(marker: ConsultMarker): void {
  try {
    window.sessionStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    // Stockage indisponible : la consultation reste active, mais un rechargement ne la fermera pas seul.
  }
}

function clearMarker(): void {
  try {
    window.sessionStorage.removeItem(MARKER_KEY);
  } catch {
    // Rien à effacer.
  }
}

/** Consultation en cours dans cet onglet (affichée par la bannière). */
let current: ConsultMarker | undefined;
const listeners = new Set<() => void>();

function setCurrent(next: ConsultMarker | undefined): void {
  current = next;
  for (const listener of listeners) listener();
}

export function getConsult(): ConsultMarker | undefined {
  return current;
}

/** Vrai si l'onglet a laissé une consultation ouverte (ex. rechargement de la page) à terminer au démarrage. */
export function hasLeftoverConsult(): boolean {
  return readMarker() !== undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConsult(): ConsultMarker | undefined {
  return useSyncExternalStore(subscribe, getConsult, getConsult);
}

/** Lit toutes les pages du compte consulté. Ne touche à rien localement. */
async function fetchAllRows(client: SupabaseClient, targetId: string): Promise<ConsultRow[]> {
  const rows: ConsultRow[] = [];
  let cursor: { changedAt: string; table: string; record: string } | undefined;
  for (;;) {
    const page = await consultPull(client, targetId, cursor);
    rows.push(...page);
    const last = page[page.length - 1];
    if (page.length < 500 || !last) break;
    cursor = { changedAt: last.changed_at, table: last.table_name, record: last.record_id };
  }
  return rows;
}

/**
 * Ouvre la consultation d'un compte. Les données du compte sont lues d'abord : en cas d'échec,
 * les données de l'administrateur ne sont pas touchées.
 * Les modifications non envoyées de l'administrateur sont perdues : l'interface le demande avant
 * (`discardUnsent`).
 */
export async function startConsult(
  client: SupabaseClient,
  adminId: string,
  targetId: string,
  options: { discardUnsent: boolean },
  database: AppDatabase = defaultDb,
): Promise<string> {
  // Vérifié avant toute autre chose : fermer une consultation ouverte ne doit jamais effacer des modifications non envoyées.
  if (!options.discardUnsent && (await pendingCount(database)) > 0) throw new ConsultError("unsynced");
  if (getConsult()) await endConsult(client, adminId, database).catch(() => undefined);

  const email = await consultStart(client, targetId);
  const remote = await fetchAllRows(client, targetId);
  // Les suppressions et les réglages ne sont pas chargés (voir le choix en tête de fichier).
  const { prepared } = await prepareRows(remote.filter((row) => !row.deleted));
  const records = prepared.filter(
    (p: Prepared) => p.kind === "put" && p.record !== undefined && p.table !== "settings",
  );

  const marker: ConsultMarker = { adminId, targetId, email };
  await disableSync(database);
  writeMarker(marker);
  setReadOnly(true);
  try {
    await withTrustedWrites(() =>
      database.transaction("rw", database.tables, async () => {
        for (const name of SYNCED_TABLES) {
          if (name === "settings") continue;
          await database.table(name).clear();
        }
        for (const p of records) {
          const table = database.table(p.table) as Table<Record<string, unknown>, string>;
          await table.put(p.record as Record<string, unknown>);
        }
      }),
    );
  } catch (error) {
    // Échec du chargement : on revient tout de suite à son propre compte.
    await endConsult(client, adminId, database).catch(() => undefined);
    throw error;
  }
  setCurrent(marker);
  return email;
}

/**
 * Termine la consultation : journal, vidage des données consultées, puis synchro de l'administrateur
 * depuis son propre compte. Lève une erreur si le réseau manque : l'état reste sûr (rien n'est envoyé,
 * et la synchro reprendra au retour du réseau).
 */
export async function endConsult(
  client: SupabaseClient,
  adminId: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  const marker = getConsult() ?? readMarker();
  clearMarker();
  setReadOnly(false);
  setCurrent(undefined);
  if (marker) await consultEnd(client, marker.targetId).catch(() => undefined);
  await enableSync(client, adminId, "remote", database);
}

/**
 * Sortie forcée (déconnexion, suppression du compte) : pas de synchro, pas de réseau requis.
 * Doit précéder toute écriture de nettoyage, sinon la garde en lecture seule les refuserait.
 */
export async function leaveConsultLocally(client?: SupabaseClient): Promise<void> {
  const marker = getConsult() ?? readMarker();
  clearMarker();
  setReadOnly(false);
  setCurrent(undefined);
  if (marker && client) await consultEnd(client, marker.targetId).catch(() => undefined);
}
