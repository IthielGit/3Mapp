import { Icon } from "../../components/Icon";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { addDays, format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, ReferenceLine, ResponsiveContainer } from "recharts";
import { db } from "../../db/database";
import { computeBalances } from "../../domain/balance";
import { backupReminder } from "../../domain/backup";
import { budgetStates } from "../../domain/budget";
import { usePeriodSettings } from "../stats/period-state";
import { convertedSum } from "../../domain/fx";
import { dailyExpenses, dailyTotals } from "../../domain/home-series";
import { Skeleton } from "../../components/PwaComponents";
import { TransactionRow, WalletCard } from "../../components/TransactionRow";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { useBalanceCutoff } from "../settings/balance-cutoff";

const EMPTY: never[] = [];
const PREVIEW = 2;

/** Engrenage des réglages (tracé ISC, Lucide), en haut à droite. */
function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Les N derniers jours (AAAA-MM-JJ), du plus ancien au plus récent. */
function lastDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) =>
    format(addDays(today, i - count + 1), "yyyy-MM-dd"),
  );
}

/**
 * Accueil : en-tête (salutation, réglages), échéances à venir en cartes défilantes,
 * vue d'ensemble avec deux mini-graphiques, carte d'action, puis portefeuilles et transactions.
 */
export function HomePage() {
  const { t } = useTranslation();
  const rates = useLiveQuery(() => db.exchangeRates.toArray(), []) ?? EMPTY;
  const walletsLoaded = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []);
  const loading = walletsLoaded === undefined;
  const wallets = walletsLoaded ?? EMPTY;
  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const recurring = useLiveQuery(() => db.recurring.toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";
  const pendingCount =
    useLiveQuery(() => db.transactions.where("status").equals("pending").count(), []) ?? 0;
  const lastBackupAt = useLiveQuery(
    async () => (await db.settings.toCollection().first())?.lastBackupAt,
    [],
  );

  const backupState = backupReminder(lastBackupAt, new Date(), transactions.length > 0);
  const active = wallets.filter((w) => !w.archived);
  const cutoff = useBalanceCutoff();
  const balances = useMemo(
    () => computeBalances(active, transactions, cutoff),
    [active, transactions, cutoff],
  );
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) ?? EMPTY;
  const periodSettings = usePeriodSettings();
  const budgetRows = useMemo(() => {
    const now = new Date();
    const states = budgetStates(
      budgets.filter((b) => !b.archived),
      transactions,
      now,
      periodSettings,
    );
    return budgets
      .filter((b) => !b.archived)
      .flatMap((budget) => {
        const state = states.get(budget.id);
        return state ? [{ budget, state }] : [];
      });
  }, [budgets, transactions, periodSettings]);
  const converted = convertedSum(
    active
      .filter((w) => w.includeInTotal)
      .map((w) => ({
        amount: balances[w.id] ?? w.initialBalance,
        currency: w.currency,
        date: new Date().toISOString(),
      })),
    baseCurrency,
    rates,
  );

  // Échéances : récurrences actives, de la plus proche à la plus lointaine.
  const upcoming = useMemo(
    () =>
      recurring
        .filter((r) => !r.archived && !r.paused)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
        .slice(0, 6),
    [recurring],
  );

  // Vue d'ensemble : solde sur 30 jours, dépenses sur 7 jours.
  // Mini-graphiques : mêmes règles que le solde et les dépenses affichés (voir domain/home-series).
  const days30 = useMemo(() => lastDays(30), []);
  const days7 = useMemo(() => days30.slice(-7), [days30]);
  const evolution = useMemo(
    () =>
      dailyTotals(active, transactions, days30, baseCurrency, rates, cutoff).map((minor) => ({
        balance: minor / 100,
      })),
    [active, transactions, days30, baseCurrency, rates, cutoff],
  );
  const expenseMinor = useMemo(
    () => dailyExpenses(transactions, days7, baseCurrency),
    [transactions, days7, baseCurrency],
  );
  const weekExpenses = days7.map((day, i) => ({ day, value: (expenseMinor[i] ?? 0) / 100 }));
  const weekTotalMinor = expenseMinor.reduce((sum, v) => sum + v, 0);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const walletName = (id: string | undefined) => active.find((w) => w.id === id)?.name ?? "";
  const recent = transactions.filter((tx) => tx.currency === baseCurrency).slice(0, PREVIEW);

  return (
    <section className="-mx-4 flex flex-col gap-5 px-4">
      <h1 className="sr-only">{t("nav.home")}</h1>

      {/* En-tête : salutation à gauche, réglages ronds à droite. */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg font-semibold text-white dark:bg-white dark:text-ink"
          >
            {t("app.title").charAt(0)}
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-ink dark:text-fg">{t("home.hello")}</span>
            <span className="text-sm text-slate-500 dark:text-muted">{t("app.title")}</span>
          </div>
        </div>
        <Link
          to="/plus"
          aria-label={t("nav.more")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
        >
          <GearIcon />
        </Link>
      </header>

      {backupState !== "none" ? (
        <Link
          to="/plus/backup"
          className="rounded-2xl bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-raised dark:text-fg"
        >
          {t("home.backupReminder")}
        </Link>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          to="/plus/recurring"
          className="rounded-2xl bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-raised dark:text-fg"
        >
          {t("home.pendingBanner", { count: pendingCount })}
        </Link>
      ) : null}

      {/* Échéances à venir : cartes défilantes, la suivante reste entrevue. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.upcoming")}</h2>
          <Link
            to="/plus/recurring"
            className="text-sm font-medium text-slate-500 underline dark:text-muted"
          >
            {t("home.seeAll")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-white/15 dark:text-muted">
            <Icon name="clock" className="h-6 w-6" />
            <span>{t("home.noUpcoming")}</span>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-200 rounded-card border border-slate-200 bg-white px-4 dark:divide-white/10 dark:border-white/15 dark:bg-card">
            {upcoming.map((r) => {
              const due = new Date(r.nextDate);
              const income = r.type === "income";
              return (
                <li key={r.id}>
                  <Link
                    to={`/plus/recurring/${r.id}`}
                    className="pressable flex min-h-[64px] items-center gap-3 py-3"
                  >
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 text-center leading-none dark:bg-raised">
                      <span className="text-base font-semibold tabular-nums text-ink dark:text-fg">
                        {format(due, "d")}
                      </span>
                      <span className="mt-0.5 text-[10px] uppercase text-slate-500 dark:text-muted">
                        {format(due, "MMM")}
                      </span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-ink dark:text-fg">
                        {r.memo || t(`transactions.types.${r.type}`)}
                      </span>
                      <span className="truncate text-xs text-slate-500 dark:text-muted">
                        {walletName(r.walletId)} · {format(due, "HH:mm")}
                      </span>
                    </div>
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
        )}
      </section>

      {/* Vue d'ensemble
      {/* Vue d'ensemble : deux cartes, chacune avec un mini-graphique. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.overviewTitle")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-3xl bg-white p-4 shadow-sm dark:bg-raised">
            <span className="text-sm font-medium text-slate-600 dark:text-muted">
              {t("home.balanceCard")}
            </span>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span
                className="text-lg font-semibold tabular-nums text-ink dark:text-fg"
                data-amount
              >
                {formatMoney(converted.total, baseCurrency)}
              </span>
            )}
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution}>
                  <ReferenceLine y={0} stroke="#b8b8c0" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#047857"
                    fill="#04785722"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-3xl bg-white p-4 shadow-sm dark:bg-raised">
            <span className="text-sm font-medium text-slate-600 dark:text-muted">
              {t("home.expenseCard")}
            </span>
            <span className="text-lg font-semibold tabular-nums text-expense dark:text-expense-dark">
              {formatMoney(weekTotalMinor, baseCurrency)}
            </span>
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekExpenses}>
                  <Bar
                    dataKey="value"
                    fill="#ee4444"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Budgets : où en est chaque budget sur sa période en cours. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink dark:text-fg">{t("home.budgetsTitle")}</h2>
          <Link
            to="/budgets"
            className="text-sm font-medium text-slate-500 underline dark:text-muted"
          >
            {t("home.manage")}
          </Link>
        </div>
        {budgetRows.length === 0 ? (
          <Link
            to="/budgets/new"
            className="rounded-card border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-white/15 dark:text-muted"
          >
            {t("home.budgetsEmpty")}
          </Link>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-200 rounded-card border border-slate-200 bg-white px-4 dark:divide-white/10 dark:border-white/15 dark:bg-card">
            {budgetRows.slice(0, 3).map(({ budget, state }) => {
              const width = Math.min(100, Math.max(0, state.percent));
              const barColor =
                state.status === "exceeded"
                  ? "bg-expense dark:bg-expense-dark"
                  : state.status === "threshold"
                    ? "bg-amber-500"
                    : "bg-income dark:bg-income-dark";
              return (
                <li key={budget.id} className="py-4">
                  <Link to={`/budgets/${budget.id}`} className="pressable flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink dark:text-fg">
                        {budget.name}
                      </span>
                      <span
                        className="shrink-0 tabular-nums text-slate-600 dark:text-muted"
                        data-amount
                      >
                        {formatMoney(state.spent, budget.currency)} /{" "}
                        {formatMoney(state.available, budget.currency)}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, state.percent)}
                      aria-label={budget.name}
                      className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-raised"
                    >
                      <div
                        className={`progress-fill h-full rounded-full ${barColor}`}
                        style={{ transform: `scaleX(${width / 100})` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Portefeuilles puis transactions récentes. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink dark:text-fg">{t("home.wallets")}</h2>
          <Link
            to="/plus/wallets"
            className="text-sm font-medium text-slate-500 underline dark:text-muted"
          >
            {t("home.manage")}
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {active.map((w) => (
            <li key={w.id}>
              <WalletCard wallet={w} balance={balances[w.id] ?? w.initialBalance} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.recent")}</h2>
          <Link
            to="/transactions"
            className="text-sm font-medium text-slate-500 underline dark:text-muted"
          >
            {t("home.seeAll")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-white/15 dark:text-muted">
            <Icon name="inbox" className="h-6 w-6" />
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
    </section>
  );
}
