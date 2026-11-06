import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageTitle } from "../../components/PageHeader";
import { buttonDanger, buttonSecondary } from "../../components/FormControls";
import { HelpTip } from "../../components/HelpTip";
import { askConfirm } from "../../components/confirm-service";
import { format } from "date-fns";
import { useSyncStatus } from "../sync/useSyncStatus";
import { useAccount } from "./AccountProvider";
import { useSignOut } from "./use-sign-out";
import { deleteOwnAccount } from "./delete-account";
import { downloadLocalBackup } from "../backup/export-backup";

/**
 * Page Compte : identité, état de la synchronisation, données et déconnexion, puis zone dangereuse en bas.
 * La connexion est obligatoire (AccountGate).
 */
export function AccountPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const sync = useSyncStatus();
  const signOutFlow = useSignOut();
  const [deleting, setDeleting] = useState(false);
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
  const busy = sync.busy || signOutFlow.busy || deleting;
  const syncNow = () => sync.syncNow();
  const shownError = sync.error;
  const email = account.session.user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  // Pastille et libellé d'état : l'erreur a priorité, puis les modifications en attente, sinon « À jour ».
  const syncDot = shownError ? "bg-red-700" : pending ? "bg-amber-500" : "bg-income";
  const syncLabel = shownError
    ? t("account.sync.buttonError")
    : pending
      ? t("account.sync.pending", { count: pending })
      : t("account.sync.upToDate");

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
    setDeleting(true);
    setDeleteError(undefined);
    const result = await deleteOwnAccount(client);
    setDeleting(false);
    if (!result.ok) setDeleteError(result.code === "network" ? "network" : "unknown");
  }

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>

      {/* Identité : initiale dans un rond, e-mail en gras, aide à droite. */}
      <div className="flex items-center gap-3 rounded-card border border-neutral-200 p-4 dark:border-white/15">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-900 dark:bg-brand-900 dark:text-brand-100"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-600 dark:text-muted">{t("account.signedInAs")}</p>
          <p className="truncate font-semibold">{email}</p>
        </div>
        <HelpTip title={t("account.help.title")} paragraphs={[t("account.help.p1"), t("account.help.p2")]} />
      </div>

      {/* Synchronisation : état visible, action secondaire (routine, pas une urgence). */}
      <section className="flex flex-col gap-3 rounded-card border border-neutral-200 p-4 dark:border-white/15">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{t("account.sync.title")}</h2>
          <span className="flex items-center gap-2 text-sm text-neutral-700 dark:text-muted">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${syncDot}`} />
            {syncLabel}
          </span>
        </div>
        <p className="text-sm text-neutral-700 dark:text-muted">
          {t("account.sync.lastSync")} :{" "}
          {state?.lastSyncAt ? format(new Date(state.lastSyncAt), "dd/MM/yyyy HH:mm") : t("account.sync.never")}
        </p>
        {shownError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {t(`account.sync.error.${shownError}`)}
          </p>
        ) : null}
        <button type="button" className={`${buttonSecondary} w-full`} disabled={busy} onClick={() => void syncNow()}>
          {t("account.sync.syncNow")}
        </button>
      </section>

      {/* Données et session : export, puis déconnexion avec son avertissement juste dessous. */}
      <section className="flex flex-col rounded-card border border-neutral-200 dark:border-white/15">
        <button
          type="button"
          className="flex min-h-[52px] items-center px-4 text-left font-medium disabled:opacity-50"
          disabled={busy}
          onClick={() => void exportData()}
        >
          {t("account.privacy.export")}
        </button>
        {exportError ? (
          <p role="alert" className="px-4 pb-3 text-sm text-red-700 dark:text-red-400">{t("account.privacy.exportError")}</p>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-neutral-200 p-4 dark:border-white/15">
          <button type="button" className={`${buttonSecondary} w-full`} disabled={busy} onClick={() => void signOutFlow.signOut()}>
            {t("account.signOut")}
          </button>
          <p className="text-sm text-neutral-600 dark:text-muted">{t("account.localNotice")}</p>
        </div>
      </section>

      {/* Zone dangereuse en bas : contour rouge seulement, la confirmation reste obligatoire. */}
      <section className="flex flex-col gap-2 rounded-card border border-red-200 p-4 dark:border-red-400/30">
        <h2 className="font-semibold">{t("account.privacy.deleteTitle")}</h2>
        <p className="text-sm text-neutral-600 dark:text-muted">{t("account.privacy.deleteHint")}</p>
        <button
          type="button"
          className={`${buttonDanger} mt-1 w-full`}
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
