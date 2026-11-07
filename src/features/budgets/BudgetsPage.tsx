import { PageTitle } from "../../components/PageHeader";
import { AccountMenu } from "../../components/AccountMenu";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { buttonPrimary } from "../../components/FormControls";
import { Icon } from "../../components/Icon";
import { budgetStates } from "../../domain/budget";
import { formatMoney } from "../../lib/money";
import { usePeriodSettings } from "../stats/period-state";
import { upTo } from "../../domain/cutoff";
import { useBalanceCutoff } from "../settings/balance-cutoff";

const EMPTY: never[] = [];

export function BudgetsPage() {
  const { t } = useTranslation();
  const settings = usePeriodSettings();
  // Budgets dont le détail (catégories, report) est déplié, un par un.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [now] = useState(() => new Date());
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? EMPTY;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const cutoff = useBalanceCutoff();
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const colors = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories]);

  const active = budgets.filter((b) => !b.archived);
  const states = useMemo(
    () => budgetStates(active, upTo(transactions, cutoff), now, settings),
    [active, transactions, now, settings, cutoff],
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Collé en haut pendant le défilement ; son fond couvre la zone de l'encoche. */}
      <header className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex min-h-11 items-center justify-between gap-2 bg-canvas px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-page">
        <PageTitle className="text-2xl font-semibold">{t("budgets.title")}</PageTitle>
        <div className="flex shrink-0 items-center gap-2">
          <AccountMenu />
        </div>
      </header>

      {active.length === 0 ? (
        // Pas de bouton en haut ici : une seule action, au centre de l’écran vide.
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-neutral-500 p-6 text-center dark:border-white/15">
          <Icon name="donut" className="h-10 w-10 text-brand-700 dark:text-brand-dark" />
          <p className="font-semibold text-ink dark:text-fg">{t("budgets.emptyTitle")}</p>
          <p className="text-sm text-neutral-600 dark:text-muted">{t("budgets.emptyHint")}</p>
          <Link to="/budgets/new" className={buttonPrimary + " inline-flex items-center"}>
            {t("budgets.createFirst")}
          </Link>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {active.map((b) => {
          const s = states.get(b.id);
          if (!s) return null;
          const width = Math.min(100, Math.max(0, s.percent));
          const barColor =
            s.status === "exceeded"
              ? "bg-red-600"
              : s.status === "threshold"
                ? "bg-amber-500"
                : "bg-brand-600";
          return (
            <li
              key={b.id}
              className="flex flex-col gap-2 rounded-card border border-neutral-200 p-4 shadow-sm dark:border-white/15"
            >
              <Link to={`/budgets/${b.id}`} className="flex flex-col gap-2">
                <div className="flex justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: colors.get(b.categoryIds[0] ?? "") ?? "#64748b" }}
                    />
                    {b.name}
                  </span>
                  <span className="text-sm text-neutral-600 dark:text-muted">{t(`budgets.periods.${b.period}`)}</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, s.percent)}
                  aria-label={b.name}
                  className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
                >
                  <div
                    className={`progress-fill h-full ${barColor}`}
                    style={{ transform: `scaleX(${width / 100})` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>
                    {formatMoney(s.spent, b.currency)} / {formatMoney(s.available, b.currency)}
                  </span>
                  <span className={s.status === "exceeded" ? "text-red-700 dark:text-red-400" : ""}>
                    {s.status === "exceeded"
                      ? t("budgets.exceededBy", { amount: formatMoney(-s.remaining, b.currency) })
                      : t("budgets.remaining", { amount: formatMoney(s.remaining, b.currency) })}
                  </span>
                </div>
                {s.dailyAllowance !== null ? (
                  <p className="text-xs text-neutral-600 dark:text-muted">
                    {t("budgets.dailyAllowance", {
                      amount: formatMoney(s.dailyAllowance, b.currency),
                    })}
                  </p>
                ) : null}
              </Link>

              {expanded.has(b.id) ? (
                <p id={`budget-details-${b.id}`} className="text-xs text-neutral-600 dark:text-muted">
                  {b.categoryIds
                    .map((id) => names.get(id))
                    .filter(Boolean)
                    .join(", ")}
                  {b.rollover ? ` · ${t("budgets.rolloverOn")}` : ""}
                </p>
              ) : null}

              {/* Bouton discret : petit visuellement, zone tactile de 44 px gardée par les marges négatives. */}
              <button
                type="button"
                className="-my-3 -mr-2 inline-flex min-h-11 items-center gap-1 self-end rounded-lg px-2 text-xs text-neutral-600 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-muted dark:hover:text-fg"
                aria-expanded={expanded.has(b.id)}
                aria-controls={`budget-details-${b.id}`}
                onClick={() => toggle(b.id)}
              >
                {expanded.has(b.id) ? t("budgets.hideDetails") : t("budgets.showDetails")}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={`h-4 w-4 transition-transform ${expanded.has(b.id) ? "rotate-180" : ""}`}
                >
                  <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Ajout en fin de liste : une carte pointillée, comme l'état vide. */}
      {active.length > 0 ? (
        <Link
          to="/budgets/new"
          className="flex min-h-11 items-center justify-center gap-2 rounded-card border border-dashed border-neutral-500 p-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:border-white/15 dark:text-brand-dark dark:hover:bg-white/10"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t("budgets.newTitle")}
        </Link>
      ) : null}
    </section>
  );
}
