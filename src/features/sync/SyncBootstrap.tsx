import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { useAccount } from "../account/AccountProvider";
import { ensureSync } from "./sync-engine";

/** Délai après une modification locale avant l'envoi (regroupe les saisies rapprochées). */
const DEBOUNCE_MS = 3000;
/** Relance régulière pendant que l'app est ouverte. */
const INTERVAL_MS = 60_000;

/**
 * Lance la synchronisation du compte connecté et bloque l'app tant que la première fusion n'est pas faite,
 * pour qu'un onboarding local ne crée pas de doublons avec les données du compte.
 * Si la première synchro échoue (hors ligne), l'app s'ouvre et l'erreur est affichée dans Compte.
 */
export function SyncBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const account = useAccount();
  // Compte pour lequel la première synchro est terminée : ne vaut que pour le compte courant.
  const [readyFor, setReadyFor] = useState<string | undefined>();
  const client = account.status === "signedIn" ? account.client : undefined;
  const userId = account.status === "signedIn" ? account.session.user.id : undefined;
  const ready = userId !== undefined && readyFor === userId;
  const pending = useLiveQuery(() => db.syncOutbox.count(), [], 0);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    const sync = () => ensureSync(client, userId).catch(() => undefined);
    void sync().finally(() => {
      if (active) setReadyFor(userId);
    });
    const onOnline = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, INTERVAL_MS);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [client, userId]);

  // Envoi après une modification locale (debounce).
  useEffect(() => {
    if (!client || !userId || !ready || pending === 0) return;
    const timer = window.setTimeout(() => {
      void ensureSync(client, userId).catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [client, userId, ready, pending]);

  if (!client || !userId) return <>{children}</>;
  if (!ready) {
    return (
      <div aria-busy="true" role="status" className="flex min-h-screen items-center justify-center p-6">
        <p className="text-neutral-600 dark:text-muted">{t("account.sync.starting")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
