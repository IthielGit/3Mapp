import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { useAccount } from "../account/AccountProvider";
import { signOutAndClear } from "../account/sign-out";
import { checkDeviceOwnership, enableSync, ensureSync } from "./sync-engine";
import type { DeviceOwnership } from "../../domain/sync";

/** Délai après une modification locale avant l'envoi (regroupe les saisies rapprochées). */
const DEBOUNCE_MS = 3000;
/** Relance régulière pendant que l'app est ouverte. */
const INTERVAL_MS = 60_000;

/**
 * Lance la synchronisation du compte connecté et bloque l'app tant que la première fusion n'est pas faite.
 * Si l'appareil contient des données qui n'appartiennent pas à ce compte, rien n'est envoyé :
 * l'utilisateur choisit explicitement quoi faire.
 */
export function SyncBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const account = useAccount();
  const [readyFor, setReadyFor] = useState<string | undefined>();
  const [choice, setChoice] = useState<{ userId: string; ownership: DeviceOwnership } | undefined>();
  const [decided, setDecided] = useState(0);
  const [busy, setBusy] = useState(false);
  const client = account.status === "signedIn" ? account.client : undefined;
  const userId = account.status === "signedIn" ? account.session.user.id : undefined;
  const ready = userId !== undefined && readyFor === userId;
  const pending = useLiveQuery(() => db.syncOutbox.count(), [], 0);

  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    let detach: (() => void) | undefined;
    const sync = () => ensureSync(client, userId).catch(() => undefined);

    void (async () => {
      const ownership = await checkDeviceOwnership(userId).catch((): DeviceOwnership => "ok");
      if (!active) return;
      if (ownership === "foreign" || ownership === "unowned") {
        setChoice({ userId, ownership });
        return;
      }
      await sync();
      if (!active) return;
      setReadyFor(userId);

      const onOnline = () => void sync();
      const onVisible = () => {
        if (document.visibilityState === "visible") void sync();
      };
      window.addEventListener("online", onOnline);
      document.addEventListener("visibilitychange", onVisible);
      const timer = window.setInterval(onVisible, INTERVAL_MS);
      detach = () => {
        window.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onVisible);
        window.clearInterval(timer);
      };
    })();

    return () => {
      active = false;
      detach?.();
    };
  }, [client, userId, decided]);

  // Envoi après une modification locale (debounce).
  useEffect(() => {
    if (!client || !userId || !ready || pending === 0) return;
    const timer = window.setTimeout(() => {
      void ensureSync(client, userId).catch(() => undefined);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [client, userId, ready, pending]);

  if (!client || !userId) return <>{children}</>;

  if (choice?.userId === userId && !ready) {
    async function choose(mode: "merge" | "remote") {
      if (!client || !userId) return;
      setBusy(true);
      try {
        await enableSync(client, userId, mode);
      } catch {
        // Hors ligne : la synchro reprendra au retour du réseau, l'app s'ouvre avec les données locales.
      }
      setBusy(false);
      setChoice(undefined);
      setDecided((n) => n + 1);
    }
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
        <h1 className="text-2xl font-semibold text-ink dark:text-fg">{t("account.device.title")}</h1>
        <p className="text-neutral-700 dark:text-muted">
          {choice.ownership === "foreign" ? t("account.device.bodyForeign") : t("account.device.bodyUnowned")}
        </p>
        <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void choose("merge")}>
          {t("account.device.merge")}
        </button>
        <p className="-mt-3 text-sm text-neutral-600 dark:text-muted">{t("account.device.mergeHint")}</p>
        <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void choose("remote")}>
          {t("account.device.replace")}
        </button>
        <p className="-mt-3 text-sm text-neutral-600 dark:text-muted">{t("account.device.replaceHint")}</p>
        <button
          type="button"
          className="min-h-[44px] self-start text-sm font-medium text-red-700 underline dark:text-red-400"
          disabled={busy}
          onClick={() => void signOutAndClear(client)}
        >
          {t("account.signOut")}
        </button>
      </main>
    );
  }

  if (!ready) {
    return (
      <div aria-busy="true" role="status" className="flex min-h-screen items-center justify-center p-6">
        <p className="text-neutral-600 dark:text-muted">{t("account.sync.starting")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
