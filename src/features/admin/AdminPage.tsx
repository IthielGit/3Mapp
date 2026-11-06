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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle className="text-2xl font-semibold">{t("admin.title")}</PageTitle>
        <Link
          to="/plus/admin/audit"
          className={`${buttonSecondary} inline-flex min-h-[44px] items-center px-3 text-sm`}
        >
          {t("admin.audit.open")}
        </Link>
      </div>

      {/* Avertissement de confidentialité : visible, pas un simple texte gris. */}
      <p
        role="note"
        className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
      >
        {t("admin.intro")}
      </p>

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
        {shown.map((a) => {
          const isSuperAdmin = a.role === "super_admin";
          const isActive = a.status === "active";
          return (
            <li key={a.id}>
              <Link
                to={`/plus/admin/accounts/${a.id}`}
                className="flex min-h-[64px] items-center gap-3 rounded-card border border-neutral-200 p-3 active:bg-neutral-50 dark:border-white/15 dark:active:bg-white/5"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{a.email}</span>
                    {a.id === selfId ? (
                      <span className="shrink-0 text-xs text-neutral-600 dark:text-muted">{t("admin.you")}</span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600 dark:text-muted">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${isActive ? "bg-income" : "bg-amber-500"}`}
                      />
                      {t(`admin.status.${a.status}`)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{t("admin.recordCount", { count: a.record_count })}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {a.last_sync_at
                        ? t("admin.lastSync", { date: format(new Date(a.last_sync_at), "dd/MM/yyyy") })
                        : t("admin.neverSynced")}
                    </span>
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isSuperAdmin
                      ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100"
                      : "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-fg"
                  }`}
                >
                  {isSuperAdmin ? t("admin.role.super_admin") : t("admin.role.user")}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 text-neutral-500"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
