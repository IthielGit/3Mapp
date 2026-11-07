/**
 * Ligne d'état de la synchronisation (accueil) : ce que l'utilisateur doit savoir de ses données.
 * Enregistrées ici seulement, en attente d'envoi, envoyées, ou bloquées par une erreur.
 * Fonctions pures : le composant traduit le résultat, il ne décide de rien.
 */

/** Code d'erreur de synchro enregistré (voir SyncErrorCode dans features/sync/sync-engine). */
export type SyncStatusErrorCode = "network" | "suspended" | "unknown" | "foreign" | "outdated";

const KNOWN_ERRORS: readonly SyncStatusErrorCode[] = ["network", "suspended", "unknown", "foreign", "outdated"];

export interface SyncStatusInput {
  /** Compte connecté : sans compte, les données ne quittent jamais l'appareil. */
  signedIn: boolean;
  /** Réseau disponible d'après le navigateur (navigator.onLine). */
  online: boolean;
  /** Synchro demandée depuis l'interface en cours. */
  busy: boolean;
  /** Modifications locales en attente d'envoi. */
  pending: number;
  /** Erreur de la dernière synchro (code enregistré ; un code inconnu compte comme « unknown »). */
  error: string | undefined;
  /** Dernière synchro réussie (ISO). */
  lastSyncAt: string | undefined;
  now: Date;
}

/** Ancienneté de la dernière synchro, arrondie pour l'affichage. */
export type SyncAgo =
  | { unit: "now" }
  | { unit: "minutes"; value: number }
  | { unit: "hours"; value: number }
  | { unit: "days"; value: number };

export type SyncStatusLine =
  /** Rien à dire (pas de compte, réseau présent). */
  | { kind: "hidden" }
  /** Hors ligne : tout reste sur l'appareil ; `pending` modifications partiront au retour du réseau. */
  | { kind: "offline"; pending: number }
  /** Synchro en cours. */
  | { kind: "syncing" }
  /** La dernière synchro a échoué. */
  | { kind: "error"; code: SyncStatusErrorCode; pending: number }
  /** Modifications enregistrées sur l'appareil, envoi imminent. */
  | { kind: "pending"; pending: number }
  /** Tout est envoyé ; `ago` absent si la date de la dernière synchro est inconnue. */
  | { kind: "upToDate"; ago: SyncAgo | undefined };

export type SyncStatusKind = SyncStatusLine["kind"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Ancienneté arrondie vers le bas (« il y a 2 min » jusqu'à 2 min 59). Une date future compte comme « à l'instant ». */
export function syncAgo(lastSyncAt: string, now: Date): SyncAgo | undefined {
  const at = Date.parse(lastSyncAt);
  if (Number.isNaN(at)) return undefined;
  const elapsed = now.getTime() - at;
  if (elapsed < MINUTE) return { unit: "now" };
  if (elapsed < HOUR) return { unit: "minutes", value: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { unit: "hours", value: Math.floor(elapsed / HOUR) };
  return { unit: "days", value: Math.floor(elapsed / DAY) };
}

function errorCode(error: string): SyncStatusErrorCode {
  return (KNOWN_ERRORS as readonly string[]).includes(error) ? (error as SyncStatusErrorCode) : "unknown";
}

/**
 * Priorités : hors ligne (la cause la plus probable de tout le reste), puis synchro en cours,
 * puis erreur, puis envois en attente, puis « à jour ».
 */
export function syncStatusLine(input: SyncStatusInput): SyncStatusLine {
  const pending = Math.max(0, input.pending);
  if (!input.online) return { kind: "offline", pending: input.signedIn ? pending : 0 };
  if (!input.signedIn) return { kind: "hidden" };
  if (input.busy) return { kind: "syncing" };
  if (input.error) return { kind: "error", code: errorCode(input.error), pending };
  if (pending > 0) return { kind: "pending", pending };
  return { kind: "upToDate", ago: input.lastSyncAt ? syncAgo(input.lastSyncAt, input.now) : undefined };
}

/** Message à annoncer aux lecteurs d'écran. */
export type SyncAnnouncement = "offline" | "restored" | "error";

/** Mémoire des annonces entre deux rendus. */
export interface SyncAnnounceMemory {
  /** Premier état vu : il est affiché, pas annoncé. */
  initialized: boolean;
  previous: SyncStatusKind | undefined;
  /** Passé hors ligne : on attend la première synchro réussie pour annoncer le retour. */
  awaitingRestore: boolean;
  /** Erreur déjà annoncée (pour ne pas la répéter à chaque relance automatique). */
  announcedError: SyncStatusErrorCode | undefined;
}

export const INITIAL_ANNOUNCE_MEMORY: SyncAnnounceMemory = {
  initialized: false,
  previous: undefined,
  awaitingRestore: false,
  announcedError: undefined,
};

/**
 * Transitions qui méritent une annonce : passage hors ligne, retour du réseau suivi d'une synchro réussie,
 * nouvelle erreur. Rien pour les synchros ordinaires ni pour l'horloge qui avance.
 * Après une synchro manuelle (état précédent « syncing »), le résultat est déjà annoncé par le bouton.
 */
export function nextSyncAnnouncement(
  memory: SyncAnnounceMemory,
  line: SyncStatusLine,
): { memory: SyncAnnounceMemory; announce: SyncAnnouncement | undefined } {
  const afterManual = memory.previous === "syncing";
  const base: SyncAnnounceMemory = { ...memory, initialized: true, previous: line.kind };

  if (!memory.initialized) {
    return {
      memory: {
        ...base,
        awaitingRestore: line.kind === "offline",
        announcedError: line.kind === "error" ? line.code : undefined,
      },
      announce: undefined,
    };
  }

  switch (line.kind) {
    case "offline":
      if (memory.awaitingRestore) return { memory: base, announce: undefined };
      return { memory: { ...base, awaitingRestore: true, announcedError: undefined }, announce: "offline" };
    case "error": {
      if (memory.announcedError === line.code) return { memory: base, announce: undefined };
      return {
        memory: { ...base, awaitingRestore: false, announcedError: line.code },
        announce: afterManual ? undefined : "error",
      };
    }
    case "upToDate":
      return {
        memory: { ...base, awaitingRestore: false, announcedError: undefined },
        announce: memory.awaitingRestore && !afterManual ? "restored" : undefined,
      };
    case "hidden":
      return { memory: { ...base, awaitingRestore: false, announcedError: undefined }, announce: undefined };
    default:
      // « syncing » et « pending » : état intermédiaire, on attend la suite.
      return { memory: base, announce: undefined };
  }
}
