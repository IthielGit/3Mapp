import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { PageTitle } from "../../components/PageHeader";
import { buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { HelpTip } from "../../components/HelpTip";
import { askConfirm } from "../../components/confirm-service";
import { format } from "date-fns";
import { db } from "../../db/database";
import { SYNC_STATE_ID } from "../../db/sync-tracking";
import { ensureSync, SyncError, type SyncErrorCode } from "../sync/sync-engine";
import { useAccount } from "./AccountProvider";
import { signOutAndClear } from "./sign-out";

/** Page Compte : identité, état de la synchronisation, déconnexion. La connexion est obligatoire (AccountGate). */
export function AccountPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const state = useLiveQuery(() => db.syncState.get(SYNC_STATE_ID), []);
  const pending = useLiveQuery(() => db.syncOutbox.count(), [], 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorCode | undefined>();

  if (account.status !== "signedIn") {
    return (
      <section className="flex flex-col gap-4">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <p aria-busy="true" className="text-neutral-600 dark:text-muted">{t("account.loading")}</p>
      </section>
    );
  }

  const client = account.client;
  const userId = account.session.user.id;
  const lastSyncError = state?.lastError as SyncErrorCode | undefined;

  async function syncNow() {
    setBusy(true);
    setError(undefined);
    try {
      await ensureSync(client, userId);
    } catch (err) {
      setError(err instanceof SyncError ? err.code : "unknown");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const lost = pending ?? 0;
    const confirmed = await askConfirm({
      message:
        t("account.signOutConfirm") + (lost > 0 ? " " + t("account.signOutLost", { count: lost }) : ""),
      confirmLabel: t("account.signOut"),
    });
    if (!confirmed) return;
    setBusy(true);
    await signOutAndClear(client);
    setBusy(false);
  }

  const shownError = error ?? lastSyncError;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <HelpTip title={t("account.help.title")} paragraphs={[t("account.help.p1"), t("account.help.p2")]} />
      </div>
      <p>
        {t("account.signedInAs")} <strong>{account.session.user.email}</strong>
      </p>

      <div className="flex flex-col gap-2 rounded-card border border-neutral-200 p-4 dark:border-white/15">
        <h2 className="font-semibold">{t("account.sync.title")}</h2>
        <p className="text-sm text-neutral-700 dark:text-muted">
          {t("account.sync.lastSync")} :{" "}
          {state?.lastSyncAt ? format(new Date(state.lastSyncAt), "dd/MM/yyyy HH:mm") : t("account.sync.never")}
        </p>
        {pending ? (
          <p className="text-sm text-neutral-700 dark:text-muted">{t("account.sync.pending", { count: pending })}</p>
        ) : null}
        {shownError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {t(`account.sync.error.${shownError}`)}
          </p>
        ) : null}
        <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void syncNow()}>
          {t("account.sync.syncNow")}
        </button>
      </div>

      <p className="text-sm text-neutral-600 dark:text-muted">{t("account.localNotice")}</p>
      <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void signOut()}>
        {t("account.signOut")}
      </button>
    </section>
  );
}
