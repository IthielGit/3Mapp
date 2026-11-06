import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db/database";
import { useAccount } from "../features/account/AccountProvider";
import { ensureSync, readSyncState } from "../features/sync/sync-engine";
import { buttonPrimary } from "./FormControls";

/**
 * Redirige vers l'onboarding tant qu'aucun réglage n'existe (premier lancement).
 * Compte connecté jamais synchronisé sur cet appareil : on n'onboarde pas, car le compte contient peut-être
 * déjà des données. On attend la première synchro (et on propose de la relancer).
 */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = useAccount();
  const settingsCount = useLiveQuery(() => db.settings.count(), []);
  const synced = useLiveQuery(async () => Boolean((await readSyncState())?.lastSyncAt), [], undefined);

  if (settingsCount === undefined) return null;
  if (settingsCount > 0) return <>{children}</>;

  if (account.status === "signedIn") {
    if (synced === undefined) return null;
    if (!synced) return <FirstSyncRequired client={account.client} userId={account.session.user.id} />;
  }
  return <Navigate to="/onboarding" replace state={{ from: location }} />;
}

/** Écran affiché tant que la première synchro du compte n'a pas abouti. Rien n'est effacé ici. */
function FirstSyncRequired({ client, userId }: { client: SupabaseClient; userId: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function retry() {
    setBusy(true);
    setFailed(false);
    try {
      await ensureSync(client, userId);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-canvas p-6 dark:bg-page">
      <h1 className="text-2xl font-semibold text-ink dark:text-fg">{t("onboarding.syncRequiredTitle")}</h1>
      <p className="text-neutral-700 dark:text-muted">{t("onboarding.syncRequiredBody")}</p>
      {failed ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t("onboarding.syncFailed")}
        </p>
      ) : null}
      <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void retry()}>
        {t("onboarding.retry")}
      </button>
    </main>
  );
}
