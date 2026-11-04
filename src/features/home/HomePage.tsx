import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { computeBalances } from "../../domain/balance";
import { backupReminder } from "../../domain/backup";
import { convertedSum } from "../../domain/fx";
import { groupByDay } from "../../domain/grouping";
import { periodSummary, transactionsIn } from "../../domain/stats";
import { EmptyState, Skeleton } from "../../components/PwaComponents";
import { TransactionRow, WalletCard } from "../../components/TransactionRow";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { PeriodPicker, periodLabel } from "../stats/PeriodPicker";
import {
  currentPeriod,
  shiftPeriod,
  usePeriodSettings,
  type PeriodState,
} from "../stats/period-state";

const EMPTY: never[] = [];
const ROW_LIMIT = 40;

export function HomePage() {
  const { t } = useTranslation();
  const settings = usePeriodSettings();
  const [state, setState] = useState<PeriodState>({ kind: "month", anchor: new Date() });
  const period = currentPeriod(state, settings);

  const rates = useLiveQuery(() => db.exchangeRates.toArray(), []) ?? EMPTY;
  const walletsLoaded = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []);
  const loading = walletsLoaded === undefined;
  const wallets = walletsLoaded ?? EMPTY;
  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
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
  const balances = useMemo(() => computeBalances(active, transactions), [active, transactions]);
  const inBase = active.filter((w) => w.includeInTotal);
  const converted = convertedSum(
    inBase.map((w) => ({
      amount: balances[w.id] ?? w.initialBalance,
      currency: w.currency,
      date: new Date().toISOString(),
    })),
    baseCurrency,
    rates,
  );
  const summary = periodSummary(transactionsIn(transactions, period, baseCurrency), period);
  const periodTransactions = transactionsIn(transactions, period, baseCurrency).slice(0, ROW_LIMIT);
  const days = groupByDay(periodTransactions);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const walletName = (id: string | undefined) => active.find((w) => w.id === id)?.name ?? "";

  return (
    <section className="flex flex-col gap-5">
      <h1 className="sr-only">{t("nav.home")}</h1>

      {backupState !== "none" ? (
        <Link
          to="/plus/backup"
          className="rounded-card bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("home.backupReminder")}
        </Link>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          to="/plus/recurring"
          className="rounded-card bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("home.pendingBanner", { count: pendingCount })}
        </Link>
      ) : null}

      {/* Carte principale : solde total, converti dans la devise de référence. */}
      <header className="flex flex-col gap-1 rounded-card bg-brand-700 p-5 text-white shadow-sm">
        <p className="text-sm opacity-90">{t("home.totalBalance")}</p>
        {loading ? (
          <Skeleton className="h-9 w-40 bg-white/30" />
        ) : (
          <p className="text-3xl font-bold" data-amount>
            {formatMoney(converted.total, baseCurrency)}
          </p>
        )}
        {converted.missing.length > 0 ? (
          <p className="text-xs opacity-90">
            {t("home.missingRate", { currencies: converted.missing.join(", ") })}
          </p>
        ) : null}
      </header>

      <PeriodPicker
        state={state}
        period={period}
        onChange={setState}
        onShift={(direction) => setState(shiftPeriod(state, settings, direction))}
      />
      <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
        {periodLabel(period)}
      </p>

      {/* Vue d'ensemble de la période. */}
      <section
        aria-label={t("home.overview")}
        className="grid grid-cols-3 gap-2 rounded-card border border-slate-200 p-3 text-center dark:border-slate-700"
      >
        <Figure
          label={t("home.income")}
          value={formatMoney(summary.income, baseCurrency)}
          tone="text-income dark:text-income-dark"
        />
        <Figure
          label={t("home.expense")}
          value={formatMoney(summary.expense, baseCurrency)}
          tone="text-expense dark:text-expense-dark"
        />
        <Figure label={t("home.net")} value={formatMoney(summary.net, baseCurrency)} />
      </section>

      {/* Portefeuilles : défilement horizontal. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("home.wallets")}</h2>
          <Link to="/plus/wallets" className="text-sm text-brand-700 underline dark:text-brand-300">
            {t("home.manage")}
          </Link>
        </div>
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {active.map((w) => (
            <li key={w.id} className="snap-start">
              <WalletCard wallet={w} balance={balances[w.id] ?? w.initialBalance} />
            </li>
          ))}
        </ul>
      </section>

      {/* Transactions de la période, groupées par jour. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("home.recent")}</h2>
          <Link to="/transactions" className="text-sm text-brand-700 underline dark:text-brand-300">
            {t("home.seeAll")}
          </Link>
        </div>

        {days.length === 0 ? (
          <EmptyState icon="🧾" title={t("home.noTransactions")} />
        ) : (
          days.map((group) => {
            const date = new Date(`${group.day}T12:00:00`);
            return (
              <section key={group.day} className="flex flex-col">
                <header className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 dark:border-slate-700">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{format(date, "dd")}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {format(date, "EEEE, MMM yyyy")}
                    </span>
                  </div>
                  <span className="font-medium" data-amount>
                    {formatMoney(group.net, baseCurrency)}
                  </span>
                </header>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.items.map((tx) => (
                    <li key={tx.id}>
                      <TransactionRow
                        transaction={tx}
                        category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                        walletName={walletName}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </section>
    </section>
  );
}

function Figure({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${tone}`} data-amount>
        {value}
      </p>
    </div>
  );
}
