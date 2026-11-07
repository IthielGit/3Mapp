import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts";
import { Icon } from "../../components/Icon";
import { TransactionRow, WalletCard } from "../../components/TransactionRow";
import { formatMoney } from "../../lib/money";
import type { HomeData } from "./useHomeData";

/** Cette semaine : les dépenses des 7 derniers jours. */
export function WeekChart({
  weekExpenses,
  weekTotalMinor,
  baseCurrency,
}: Pick<HomeData, "weekExpenses" | "weekTotalMinor" | "baseCurrency">) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="week-title" className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-title" className="font-semibold text-ink dark:text-fg">
          {t("home.expenseCard")}
        </h2>
        <span className="text-sm font-medium tabular-nums text-ink dark:text-fg" data-amount>
          {formatMoney(weekTotalMinor, baseCurrency)}
        </span>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={weekExpenses}>
            <Bar dataKey="value" radius={[8, 8, 4, 4]} isAnimationActive={false}>
              {weekExpenses.map((entry, i) => (
                <Cell key={entry.day} fill={i === weekExpenses.length - 1 ? "#0B7E9D" : "#4a9d91"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/** Comptes : tous les comptes actifs, avec leur solde. */
export function WalletsSection({ active, balances }: Pick<HomeData, "active" | "balances">) {
  const { t } = useTranslation();
  if (active.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.wallets")}</h2>
        <Link
          to="/plus/wallets"
          className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
        >
          {t("home.manage")}
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {active.map((w) => (
          <li key={w.id} className="min-w-0">
            <WalletCard wallet={w} balance={balances[w.id] ?? w.initialBalance} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Échéances à venir : les trois prochaines récurrences. */
export function UpcomingSection({ upcoming, walletName }: Pick<HomeData, "upcoming" | "walletName">) {
  const { t } = useTranslation();
  if (upcoming.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.upcoming")}</h2>
        <Link
          to="/plus/recurring"
          className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
        >
          {t("home.seeAll")}
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-neutral-200 rounded-3xl bg-white px-4 shadow-sm dark:divide-white/10 dark:bg-card">
        {upcoming.slice(0, 3).map((r) => {
          const due = new Date(r.nextDate);
          const income = r.type === "income";
          return (
            <li key={r.id}>
              <Link to={`/plus/recurring/${r.id}`} className="pressable flex min-h-[64px] items-center gap-3 py-3">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-center leading-none dark:bg-raised">
                  <span className="text-base font-semibold tabular-nums text-ink dark:text-fg">{format(due, "d")}</span>
                  <span className="mt-0.5 text-[10px] uppercase text-neutral-600 dark:text-muted">{format(due, "MMM")}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink dark:text-fg">
                    {r.memo || t(`transactions.types.${r.type}`)}
                  </span>
                  <span className="truncate text-xs text-neutral-600 dark:text-muted">{walletName(r.walletId)}</span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${income ? "text-income dark:text-income-dark" : "text-expense dark:text-expense-dark"}`}
                  data-amount
                >
                  {income ? "+" : "−"}
                  {formatMoney(r.amount, r.currency)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Budgets : les trois premiers, avec ce qui est dépensé et ce qui reste. */
export function BudgetsSection({ budgetRows }: Pick<HomeData, "budgetRows">) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.budgetsTitle")}</h2>
        <Link
          to="/budgets"
          className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
        >
          {t("home.manage")}
        </Link>
      </div>
      {budgetRows.length === 0 ? (
        <Link
          to="/budgets/new"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 underline dark:text-brand-dark"
        >
          {t("home.budgetsEmpty")}
        </Link>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-3xl bg-white px-4 shadow-sm dark:divide-white/10 dark:bg-card">
          {budgetRows.slice(0, 3).map(({ budget, state }) => {
            const width = Math.min(100, Math.max(0, state.percent));
            const barColor =
              state.status === "exceeded"
                ? "bg-expense dark:bg-expense-dark"
                : state.status === "threshold"
                  ? "bg-amber-500"
                  : "bg-brand-600 dark:bg-brand-dark";
            return (
              <li key={budget.id} className="py-4">
                <Link to={`/budgets/${budget.id}`} className="pressable flex min-h-[44px] flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink dark:text-fg">{budget.name}</span>
                    <span className="shrink-0 tabular-nums text-neutral-600 dark:text-muted" data-amount>
                      {formatMoney(state.spent, budget.currency)} / {formatMoney(state.available, budget.currency)}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, state.percent)}
                    aria-label={budget.name}
                    className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-raised"
                  >
                    <div className={`progress-fill h-full rounded-full ${barColor}`} style={{ transform: `scaleX(${width / 100})` }} />
                  </div>
                  {state.status === "exceeded" ? (
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                      {t("budgets.exceededBy", { amount: formatMoney(-state.remaining, budget.currency) })}
                    </p>
                  ) : state.status === "threshold" ? (
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {t("budgets.remaining", { amount: formatMoney(state.remaining, budget.currency) })}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Dernières transactions dans la devise de référence. */
export function RecentSection({
  recent,
  categoryById,
  walletName,
}: Pick<HomeData, "recent" | "categoryById" | "walletName">) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.recent")}</h2>
        <Link
          to="/transactions"
          className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
        >
          {t("home.seeAll")}
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-500 p-4 text-center text-sm text-neutral-600 dark:border-white/15 dark:text-muted">
          <Icon name="inbox" className="h-6 w-6 text-teal-600 dark:text-teal-300" />
          <span>{t("home.noTransactions")}</span>
        </div>
      ) : (
        <ul className="flex flex-col">
          {recent.map((tx) => (
            <li key={tx.id}>
              <TransactionRow
                transaction={tx}
                category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                walletName={walletName}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
