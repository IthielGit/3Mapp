import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageTitle } from "../../components/PageHeader";
import { buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { HelpTip } from "../../components/HelpTip";
import { askConfirm } from "../../components/confirm-service";
import { format } from "date-fns";
import { useSyncStatus } from "../sync/useSyncStatus";
import { useAccount } from "./AccountProvider";
import { signOutAndClear } from "./sign-out";
import { deleteOwnAccount } from "./delete-account";
import { downloadLocalBackup } from "../backup/export-backup";

/** Page Compte : identité, état de la synchronisation, déconnexion. La connexion est obligatoire (AccountGate). */
export function AccountPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const sync = useSyncStatus();
  const [signingOut, setSigningOut] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [deleteError, setDeleteError] = useState<"network" | "unknown" | undefined>();

  if (account.status !== "signedIn") {
    return (
      <section className="flex flex-col gap-4">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <p aria-busy="true" className="text-neutral-600 dark:text-muted">{t("account.loading")}</p>
      </section>
    );
  }

  const client = account.client;
  const state = sync.state;
  const pending = sync.pending;
  const busy = sync.busy || signingOut;
  const syncNow = () => sync.syncNow();

  async function signOut() {
    const lost = pending;
    const confirmed = await askConfirm({
      message:
        t("account.signOutConfirm") + (lost > 0 ? " " + t("account.signOutLost", { count: lost }) : ""),
      confirmLabel: t("account.signOut"),
    });
    if (!confirmed) return;
    setSigningOut(true);
    await signOutAndClear(client);
    setSigningOut(false);
  }

  const shownError = sync.error;

  /** Export RGPD : une sauvegarde complète de cet appareil, téléchargée. */
  async function exportData() {
    setExportError(false);
    try {
      await downloadLocalBackup();
    } catch {
      setExportError(true);
    }
  }

  /** Suppression définitive du compte et de ses données (serveur puis appareil). */
  async function removeAccount() {
    const confirmed = await askConfirm({
      message: t("account.privacy.deleteConfirm"),
      confirmLabel: t("account.privacy.delete"),
      danger: true,
    });
    if (!confirmed) return;
    setSigningOut(true);
    setDeleteError(undefined);
    const result = await deleteOwnAccount(client);
    setSigningOut(false);
    if (!result.ok) setDeleteError(result.code === "network" ? "network" : "unknown");
  }

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
      <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void exportData()}>
        {t("account.privacy.export")}
      </button>
      {exportError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t("account.privacy.exportError")}</p>
      ) : null}
      <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void signOut()}>
        {t("account.signOut")}
      </button>

      <section className="flex flex-col gap-2 rounded-card border border-red-200 p-4 dark:border-red-400/30">
        <h2 className="font-semibold">{t("account.privacy.deleteTitle")}</h2>
        <p className="text-sm text-neutral-600 dark:text-muted">{t("account.privacy.deleteHint")}</p>
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-red-700 font-semibold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => void removeAccount()}
        >
          {t("account.privacy.delete")}
        </button>
        {deleteError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(`account.privacy.error.${deleteError}`)}</p>
        ) : null}
      </section>
    </section>
  );
}
