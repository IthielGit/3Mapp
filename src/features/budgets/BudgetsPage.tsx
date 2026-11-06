import { PageTitle } from "../../components/PageHeader";
import { AccountMenu } from "../../components/AccountMenu";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { buttonPrimary, buttonSecondary } from "../../components/FormControls";
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
  const [extended, setExtended] = useState(false);
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
      <header className="flex items-center justify-between gap-2">
        <PageTitle className="text-2xl font-semibold">{t("budgets.title")}</PageTitle>
        {active.length > 0 ? (
          <Link to="/budgets/new" className={buttonPrimary + " inline-flex items-center"}>
            {t("common.add")}
          </Link>
        ) : null}
        <AccountMenu />
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
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            className={buttonSecondary}
            aria-pressed={extended}
            onClick={() => setExtended((e) => !e)}
          >
            {extended ? t("budgets.hideDetails") : t("budgets.showDetails")}
          </button>
        </div>
      )}

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

              {extended ? (
                <p className="text-xs text-neutral-600 dark:text-muted">
                  {b.categoryIds
                    .map((id) => names.get(id))
                    .filter(Boolean)
                    .join(", ")}
                  {b.rollover ? ` · ${t("budgets.rolloverOn")}` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
