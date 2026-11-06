import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { PageTitle } from "../../components/PageHeader";
import { buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { askConfirm } from "../../components/confirm-service";
import { useAccount } from "../account/AccountProvider";
import { SYNCED_TABLES } from "../../db/sync-tracking";
import {
  AdminError,
  deleteAccount,
  listAccounts,
  listRecords,
  setAccountRole,
  setAccountStatus,
  type AdminAccount,
  type AdminRecord,
} from "./admin-service";
import { startConsult } from "./consult";
import { pendingCount } from "../sync/sync-engine";
import { summarizeRecord } from "./format";

/** Fiche d'un compte : identité, contenu en lecture seule, consultation, rôle, suspension, réactivation, suppression. */
export function AccountDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const account = useAccount();
  const client = account.status === "signedIn" ? account.client : undefined;
  const selfId = account.status === "signedIn" ? account.session.user.id : undefined;
  const isSelf = selfId !== undefined && id === selfId;
  const [target, setTarget] = useState<AdminAccount | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [table, setTable] = useState<string>("transactions");
  const [records, setRecords] = useState<AdminRecord[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [reload, setReload] = useState(0);
  const tables = SYNCED_TABLES.filter((name) => name !== "settings");

  useEffect(() => {
    if (!client) return;
    let active = true;
    listAccounts(client)
      .then((rows) => {
        if (!active) return;
        const found = rows.find((row) => row.id === id);
        setTarget(found);
        setNotFound(!found);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof AdminError ? err.code : "unknown");
      });
    return () => {
      active = false;
    };
  }, [client, id, reload]);

  useEffect(() => {
    if (!client || !id) return;
    let active = true;
    listRecords(client, id, table)
      .then((rows) => active && setRecords(rows))
      .catch((err: unknown) => {
        if (active) setError(err instanceof AdminError ? err.code : "unknown");
      });
    return () => {
      active = false;
    };
  }, [client, id, table]);

  if (!client) return null;
  if (notFound) return <p className="text-neutral-600 dark:text-muted">{t("admin.notFound")}</p>;
  if (!target) {
    return error ? (
      <p role="alert" className="text-red-700 dark:text-red-400">{t(`admin.error.${error}`)}</p>
    ) : (
      <p className="text-neutral-600 dark:text-muted">{t("admin.loading")}</p>
    );
  }

  async function toggleStatus() {
    if (!client || !target) return;
    const suspend = target.status === "active";
    const confirmed = await askConfirm({
      message: suspend
        ? t("admin.confirmSuspend", { email: target.email })
        : t("admin.confirmReactivate", { email: target.email }),
      confirmLabel: suspend ? t("admin.suspend") : t("admin.reactivate"),
      danger: suspend,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await setAccountStatus(client, target.id, suspend ? "suspended" : "active");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof AdminError ? err.code : "unknown");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole() {
    if (!client || !target) return;
    // Son propre rôle : refus affiché tout de suite, sans appel à la base.
    if (isSelf) {
      setError("selfAction");
      return;
    }
    const promote = target.role !== "super_admin";
    const confirmed = await askConfirm({
      message: promote ? t("admin.confirmPromote", { email: target.email }) : t("admin.confirmDemote", { email: target.email }),
      confirmLabel: promote ? t("admin.makeSuperAdmin") : t("admin.makeStandard"),
      danger: !promote,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await setAccountRole(client, target.id, promote ? "super_admin" : "user");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof AdminError ? err.code : "unknown");
    } finally {
      setBusy(false);
    }
  }

  async function viewAs() {
    if (!client || !selfId || !target) return;
    const unsent = await pendingCount().catch(() => 0);
    if (unsent > 0) {
      const confirmed = await askConfirm({
        message: t("admin.consult.confirmUnsent"),
        confirmLabel: t("admin.consult.start"),
        danger: true,
      });
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await startConsult(client, selfId, target.id, { discardUnsent: unsent > 0 });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof AdminError ? err.code : "unknown");
      setBusy(false);
    }
  }

  /** Suppression : seulement si l'e-mail du compte est saisi exactement. */
  async function remove() {
    if (!client || !target || confirmEmail.trim() !== target.email) return;
    setBusy(true);
    try {
      await deleteAccount(client, target.id);
      navigate("/plus/admin", { replace: true });
    } catch (err) {
      setError(err instanceof AdminError ? err.code : "unknown");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <PageTitle className="break-all text-2xl font-semibold">{target.email}</PageTitle>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-neutral-600 dark:text-muted">{t("admin.field.status")}</dt>
        <dd className="font-medium">{t(`admin.status.${target.status}`)}</dd>
        <dt className="text-neutral-600 dark:text-muted">{t("admin.field.created")}</dt>
        <dd className="font-medium">{format(new Date(target.created_at), "dd/MM/yyyy")}</dd>
        <dt className="text-neutral-600 dark:text-muted">{t("admin.field.lastSync")}</dt>
        <dd className="font-medium">
          {target.last_sync_at ? format(new Date(target.last_sync_at), "dd/MM/yyyy HH:mm") : t("admin.neverSynced")}
        </dd>
        <dt className="text-neutral-600 dark:text-muted">{t("admin.field.records")}</dt>
        <dd className="font-medium">{target.record_count}</dd>
      </dl>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">{t(`admin.error.${error}`)}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        {isSelf ? <p className="text-sm text-neutral-600 dark:text-muted">{t("admin.selfNote")}</p> : null}
        {!isSelf ? (
          <>
            <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void viewAs()}>
              {t("admin.consult.start")}
            </button>
            <p className="-mt-1 text-sm text-neutral-600 dark:text-muted">{t("admin.consult.hint")}</p>
          </>
        ) : null}
        {/* Affiché aussi pour son propre compte : le refus s'affiche alors au clic. */}
        <button type="button" className={buttonSecondary} disabled={busy} onClick={() => void changeRole()}>
          {target.role === "super_admin" ? t("admin.makeStandard") : t("admin.makeSuperAdmin")}
        </button>
        {!isSelf ? (
          <>
            <button
              type="button"
              className={target.status === "active" ? buttonSecondary : buttonPrimary}
              disabled={busy}
              onClick={() => void toggleStatus()}
            >
              {target.status === "active" ? t("admin.suspend") : t("admin.reactivate")}
            </button>
            {!deleteOpen ? (
              <button
                type="button"
                className="min-h-[44px] rounded-xl bg-red-700 font-semibold text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                {t("admin.delete")}
              </button>
            ) : (
              <section className="flex flex-col gap-2 rounded-card border border-red-300 p-3 dark:border-red-800" aria-labelledby="delete-title">
                <h3 id="delete-title" className="font-semibold text-red-700 dark:text-red-400">
                  {t("admin.deleteTitle")}
                </h3>
                <p className="text-sm">{t("admin.deleteWarning")}</p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("admin.deleteTypeEmail", { email: target.email })}</span>
                  <input
                    type="text"
                    autoComplete="off"
                    className={inputClass}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
                    disabled={busy || confirmEmail.trim() !== target.email}
                    onClick={() => void remove()}
                  >
                    {t("admin.deleteForever")}
                  </button>
                  <button
                    type="button"
                    className={buttonSecondary}
                    disabled={busy}
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmEmail("");
                    }}
                  >
                    {t("admin.cancel")}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("admin.contents")}</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("admin.table")}</span>
          <select className={inputClass} value={table} onChange={(e) => setTable(e.target.value)}>
            {tables.map((name) => (
              <option key={name} value={name}>
                {t(`admin.tables.${name}`, { defaultValue: name })}
              </option>
            ))}
          </select>
        </label>

        {records === undefined ? <p className="text-neutral-600 dark:text-muted">{t("admin.loading")}</p> : null}
        {records && records.length === 0 ? <p className="text-neutral-600 dark:text-muted">{t("admin.noRecords")}</p> : null}
        <ul className="flex flex-col gap-1 text-sm">
          {records?.map((r) => (
            <li key={r.record_id} className="rounded-xl border border-neutral-200 p-2 dark:border-white/15">
              <span className="block break-words">{summarizeRecord(r.data)}</span>
              <span className="text-xs text-neutral-600 dark:text-muted">
                {format(new Date(r.updated_at), "dd/MM/yyyy HH:mm")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
