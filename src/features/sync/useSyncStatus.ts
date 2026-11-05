import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { SYNC_STATE_ID, type SyncStateRow } from "../../db/sync-tracking";
import { useAccount } from "../account/AccountProvider";
import { ensureSync, SyncError, type SyncErrorCode } from "./sync-engine";

export interface SyncStatus {
  /** Compte connecté (absent hors connexion). */
  signedIn: boolean;
  /** État enregistré sur cet appareil (dernière synchro, dernière erreur). */
  state: SyncStateRow | undefined;
  /** Modifications locales en attente d'envoi. */
  pending: number;
  /** Une synchro manuelle ou automatique est demandée depuis l'interface. */
  busy: boolean;
  /** Erreur de la dernière demande manuelle, ou erreur enregistrée. */
  error: SyncErrorCode | undefined;
  /** Lance une synchro immédiate. */
  syncNow: () => Promise<void>;
}

/**
 * État de la synchronisation pour l'interface (page Compte et bouton de l'accueil).
 * La synchro automatique est gérée par SyncBootstrap ; ce hook ne fait que l'afficher et permettre de la relancer.
 */
export function useSyncStatus(): SyncStatus {
  const account = useAccount();
  const state = useLiveQuery(() => db.syncState.get(SYNC_STATE_ID), []);
  const pending = useLiveQuery(() => db.syncOutbox.count(), [], 0);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<SyncErrorCode | undefined>();

  const signedIn = account.status === "signedIn";
  const client = account.status === "signedIn" ? account.client : undefined;
  const userId = account.status === "signedIn" ? account.session.user.id : undefined;

  async function syncNow() {
    if (!client || !userId || busy) return;
    setBusy(true);
    setRequestError(undefined);
    try {
      await ensureSync(client, userId);
    } catch (err) {
      setRequestError(err instanceof SyncError ? err.code : "unknown");
    } finally {
      setBusy(false);
    }
  }

  return {
    signedIn,
    state,
    pending: pending ?? 0,
    busy,
    error: requestError ?? (state?.lastError as SyncErrorCode | undefined),
    syncNow,
  };
}
