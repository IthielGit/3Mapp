import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { PageTitle } from "../../components/PageHeader";
import { useAccount } from "../account/AccountProvider";
import { AdminError, listAudit, type AdminAuditEntry } from "./admin-service";

/** Journal des actions administratives : consultations, suspensions, réactivations, suppressions. */
export function AuditPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const client = account.status === "signedIn" ? account.client : undefined;
  const [rows, setRows] = useState<AdminAuditEntry[] | undefined>();
  const [error, setError] = useState<string | undefined>();

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
  }, [client]);

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">{t("admin.audit.title")}</PageTitle>
      {error ? <p role="alert" className="text-red-700 dark:text-red-400">{t(`admin.error.${error}`)}</p> : null}
      {rows === undefined && !error ? <p className="text-neutral-600 dark:text-muted">{t("admin.loading")}</p> : null}
      {rows && rows.length === 0 ? <p className="text-neutral-600 dark:text-muted">{t("admin.audit.none")}</p> : null}
      <ul className="flex flex-col gap-2 text-sm">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-xl border border-neutral-200 p-3 dark:border-white/15">
            <span className="block font-medium">{actionLabel(r.action, t)}</span>
            <span className="block break-all text-neutral-600 dark:text-muted">{r.target_email ?? "—"}</span>
            <span className="text-xs text-neutral-600 dark:text-muted">{format(new Date(r.at), "dd/MM/yyyy HH:mm")}</span>
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
