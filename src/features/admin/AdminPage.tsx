import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { PageTitle } from "../../components/PageHeader";
import { buttonSecondary, inputClass } from "../../components/FormControls";
import { useAccount } from "../account/AccountProvider";
import { listAccounts, AdminError, type AdminAccount } from "./admin-service";

/** Console super administrateur : liste des comptes, recherche, accès au journal. */
export function AdminPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const client = account.status === "signedIn" ? account.client : undefined;
  const selfId = account.status === "signedIn" ? account.session.user.id : undefined;
  const [accounts, setAccounts] = useState<AdminAccount[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!client) return;
    let active = true;
    listAccounts(client)
      .then((rows) => active && setAccounts(rows))
      .catch((err: unknown) => {
        if (active) setError(err instanceof AdminError ? err.code : "unknown");
      });
    return () => {
      active = false;
    };
  }, [client]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (accounts ?? []).filter((a) => q === "" || a.email.toLowerCase().includes(q));
  }, [accounts, query]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <PageTitle className="text-2xl font-semibold">{t("admin.title")}</PageTitle>
        <Link to="/plus/admin/audit" className={`${buttonSecondary} min-h-[44px] px-3 text-sm`}>
          {t("admin.audit.open")}
        </Link>
      </div>
      <p className="text-sm text-neutral-600 dark:text-muted">{t("admin.intro")}</p>

      <input
        type="search"
        aria-label={t("admin.search")}
        placeholder={t("admin.search")}
        className={inputClass}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">{t(`admin.error.${error}`)}</p>
      ) : null}
      {accounts === undefined && !error ? <p className="text-neutral-600 dark:text-muted">{t("admin.loading")}</p> : null}
      {accounts && shown.length === 0 ? <p className="text-neutral-600 dark:text-muted">{t("admin.none")}</p> : null}

      <ul className="flex flex-col gap-2">
        {shown.map((a) => (
          <li key={a.id}>
            <Link
              to={`/plus/admin/accounts/${a.id}`}
              className="flex min-h-[64px] flex-col gap-1 rounded-card border border-neutral-200 p-3 dark:border-white/15"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {a.email}
                  {a.id === selfId ? <span className="ml-2 text-xs font-normal text-neutral-600 dark:text-muted">{t("admin.you")}</span> : null}
                </span>
                <span className="shrink-0 text-xs font-semibold">
                  {a.role === "super_admin" ? t("admin.role.super_admin") : t("admin.role.user")}
                </span>
              </span>
              <span className="flex flex-wrap gap-x-3 text-xs text-neutral-600 dark:text-muted">
                <span>{t(`admin.status.${a.status}`)}</span>
                <span>{t("admin.recordCount", { count: a.record_count })}</span>
                <span>
                  {a.last_sync_at
                    ? t("admin.lastSync", { date: format(new Date(a.last_sync_at), "dd/MM/yyyy") })
                    : t("admin.neverSynced")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
