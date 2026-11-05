/**
 * Règles pures de la synchronisation (plan « comptes », phase C).
 * Aucune dépendance au navigateur ni au réseau : tout est testable en unitaire.
 */

/** Identifiant fixe du réglage synchronisé : chaque appareil a son propre identifiant local. */
export const SETTINGS_RECORD_ID = "settings";

/**
 * Champs des réglages propres à l'appareil : jamais envoyés, jamais écrasés par le serveur.
 * Le PIN et la biométrie ne quittent pas l'appareil (SPEC §5.15).
 */
export const SETTINGS_DEVICE_FIELDS = [
  "pinHash",
  "pinSalt",
  "pinFailures",
  "pinLockedUntil",
  "biometricCredentialId",
  "autoLockSeconds",
  "hideAmounts",
  "lastBackupAt",
  "lastReminderDay",
] as const;

/** Retire les champs propres à l'appareil d'un réglage avant envoi. */
export function stripDeviceFields<T extends Record<string, unknown>>(settings: T): Partial<T> {
  const device = new Set<string>(SETTINGS_DEVICE_FIELDS);
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !device.has(key))) as Partial<T>;
}

/** Vrai si la version distante doit remplacer la locale : absente localement, ou strictement plus récente. */
export function shouldApplyRemote(local: { updatedAt: string } | undefined, remoteUpdatedAt: string): boolean {
  if (!local) return true;
  return Date.parse(remoteUpdatedAt) > Date.parse(local.updatedAt);
}

/**
 * Vrai si une suppression distante doit être appliquée : seulement si la suppression est aussi récente
 * que la dernière modification locale. Une modification faite après la suppression l'emporte.
 */
export function shouldApplyTombstone(local: { updatedAt: string } | undefined, tombstoneAt: string): boolean {
  if (!local) return false;
  return Date.parse(tombstoneAt) >= Date.parse(local.updatedAt);
}

/** Découpe une liste en lots de taille fixe (limite des envois et des pages de lecture). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError("La taille de lot doit être positive");
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** Recule une date ISO de quelques secondes, pour relire les lignes écrites pendant la lecture précédente. */
export function overlapSince(cursorIso: string, seconds = 5): string {
  return new Date(Date.parse(cursorIso) - seconds * 1000).toISOString();
}

/** Clé d'un enregistrement dans la file d'envoi. */
export function outboxKey(table: string, recordId: string): string {
  return `${table}|${recordId}`;
}

/**
 * À qui appartiennent les données de cet appareil ?
 * - empty : aucune donnée locale, rien à protéger ;
 * - ok : les données sont déjà liées à ce compte ;
 * - foreign : elles sont liées à un autre compte (session expirée sans déconnexion) ;
 * - unowned : des données existent sans compte associé (avant les comptes, ou état incomplet).
 */
export type DeviceOwnership = "empty" | "ok" | "foreign" | "unowned";

export function deviceOwnership(
  state: { userId?: string } | undefined,
  localRecords: number,
  userId: string,
): DeviceOwnership {
  if (localRecords === 0) return "empty";
  if (!state?.userId) return "unowned";
  return state.userId === userId ? "ok" : "foreign";
}
