import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { computeBalances } from "../../domain/balance";
import { EmptyState, Skeleton } from "../../components/PwaComponents";
import { backupReminder } from "../../domain/backup";
import { convertedSum } from "../../domain/fx";
import { periodSummary, transactionsIn } from "../../domain/stats";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { PeriodPicker, periodLabel } from "../stats/PeriodPicker";
import {
  currentPeriod,
  shiftPeriod,
  usePeriodSettings,
  type PeriodState,
} from "../stats/period-state";

const EMPTY: never[] = [];

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
  const totalBalance = converted.total;
  const missingRates = converted.missing;
  const summary = periodSummary(transactionsIn(transactions, period, baseCurrency), period);
  const recent = transactions.filter((tx) => tx.currency === baseCurrency).slice(0, 5);
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{t("nav.home")}</h1>
      {backupState !== "none" ? (
        <Link
          to="/plus/backup"
          className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("home.backupReminder")}
        </Link>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          to="/plus/recurring"
          className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("home.pendingBanner", { count: pendingCount })}
        </Link>
      ) : null}
      <header className="flex flex-col gap-1">
        <p className="text-sm text-slate-500">{t("home.totalBalance")}</p>
        {loading ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <p className="text-3xl font-bold" data-amount>
            {formatMoney(totalBalance, baseCurrency)}
          </p>
        )}
        {missingRates.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t("home.missingRate", { currencies: missingRates.join(", ") })}
          </p>
        ) : null}
      </header>

      <ul className="grid grid-cols-2 gap-2">
        {active.map((w) => (
          <li key={w.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <Link to={`/plus/wallets/${w.id}`} className="flex flex-col">
              <span className="text-sm text-slate-500">
                {w.icon} {w.name}
              </span>
              <span className="font-semibold" data-amount>
                {formatMoney(balances[w.id] ?? w.initialBalance, w.currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <PeriodPicker
        state={state}
        period={period}
        onChange={setState}
        onShift={(direction) => setState(shiftPeriod(state, settings, direction))}
      />
      <p className="text-center text-sm text-slate-500">{periodLabel(period)}</p>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <Figure label={t("home.income")} value={formatMoney(summary.income, baseCurrency)} />
        <Figure label={t("home.expense")} value={formatMoney(summary.expense, baseCurrency)} />
        <Figure label={t("home.net")} value={formatMoney(summary.net, baseCurrency)} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("home.recent")}</h2>
          <Link to="/transactions" className="text-sm text-brand-700 underline">
            {t("home.seeAll")}
          </Link>
        </div>
        {recent.length === 0 ? <EmptyState icon="🧾" title={t("home.noTransactions")} /> : null}
        <ul className="flex flex-col gap-2">
          {recent.map((tx) => (
            <li key={tx.id}>
              <Link
                to={`/transactions/${tx.id}/edit`}
                className="flex justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <span className="truncate text-sm">
                  {tx.type === "transfer"
                    ? `${walletName.get(tx.walletId) ?? ""} → ${walletName.get(tx.toWalletId ?? "") ?? ""}`
                    : tx.memo || t(`transactions.types.${tx.type}`)}
                </span>
                <span className="whitespace-nowrap font-medium">
                  {formatMoney(tx.amount, tx.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link
        to="/transactions/new"
        aria-label={t("transactions.add")}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-3xl text-white shadow-lg"
      >
        +
      </Link>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold" data-amount>
        {value}
      </p>
    </div>
  );
}
