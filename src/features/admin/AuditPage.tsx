import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { PageTitle } from "../../components/PageHeader";
import { askConfirm } from "../../components/confirm-service";
import { useAccount } from "../account/AccountProvider";
import { AdminError, deleteAuditEntries, listAudit, type AdminAuditEntry } from "./admin-service";

/** Journal des actions administratives : consultations, suspensions, réactivations, suppressions. */
export function AuditPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const client = account.status === "signedIn" ? account.client : undefined;
  const [rows, setRows] = useState<AdminAuditEntry[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<number | undefined>();

  useEffect(() => {
    if (!client) return;
    let active = true;
    listAudit(client)
      .then((list) => active && setRows(list))
      .catch((err: unknown) => {
        if (active) setError(err instanceof AdminError ? err.code : "unknown");
      });
    return () => {
      active = false;
    };
  }, [client, reload]);

  /** Supprime une entrée du journal, après confirmation. Seul le super administrateur peut le faire. */
  async function remove(entry: AdminAuditEntry) {
    if (!client) return;
    const confirmed = await askConfirm({
      message: t("admin.audit.confirmDelete"),
      confirmLabel: t("admin.audit.delete"),
      danger: true,
    });
    if (!confirmed) return;
    setBusyId(entry.id);
    try {
      await deleteAuditEntries(client, [entry.id]);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof AdminError ? err.code : "unknown");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">{t("admin.audit.title")}</PageTitle>
      {error ? <p role="alert" className="text-red-700 dark:text-red-400">{t(`admin.error.${error}`)}</p> : null}
      {rows === undefined && !error ? <p className="text-neutral-600 dark:text-muted">{t("admin.loading")}</p> : null}
      {rows && rows.length === 0 ? <p className="text-neutral-600 dark:text-muted">{t("admin.audit.none")}</p> : null}
      <ul className="flex flex-col gap-2 text-sm">
        {rows?.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3 dark:border-white/15">
            <span className="min-w-0">
              <span className="block font-medium">{actionLabel(r.action, t)}</span>
              <span className="block break-all text-neutral-600 dark:text-muted">{r.target_email ?? "—"}</span>
              <span className="text-xs text-neutral-600 dark:text-muted">{format(new Date(r.at), "dd/MM/yyyy HH:mm")}</span>
            </span>
            <button
              type="button"
              disabled={busyId !== undefined}
              onClick={() => void remove(r)}
              className="min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-semibold text-red-700 underline disabled:opacity-50 dark:text-red-400"
            >
              {t("admin.audit.delete")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function actionLabel(action: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (action.startsWith("view:")) return t("admin.audit.view", { table: action.slice(5) });
  return t(`admin.audit.action.${action}`, { defaultValue: action });
}
