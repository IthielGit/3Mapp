import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { computeBalances } from "../../domain/balance";
import { periodSummary, transactionsIn } from "../../domain/stats";
import { formatMoney, sumMinor, type CurrencyCode } from "../../lib/money";
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

  const wallets = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []) ?? EMPTY;
  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";

  const active = wallets.filter((w) => !w.archived);
  const balances = useMemo(() => computeBalances(active, transactions), [active, transactions]);
  const inBase = active.filter((w) => w.includeInTotal && w.currency === baseCurrency);
  const totalBalance = sumMinor(inBase.map((w) => balances[w.id] ?? w.initialBalance));
  const summary = periodSummary(transactionsIn(transactions, period, baseCurrency), period);
  const recent = transactions.filter((tx) => tx.currency === baseCurrency).slice(0, 5);
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{t("nav.home")}</h1>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-slate-500">{t("home.totalBalance")}</p>
        <p className="text-3xl font-bold">{formatMoney(totalBalance, baseCurrency)}</p>
      </header>

      <ul className="grid grid-cols-2 gap-2">
        {active.map((w) => (
          <li key={w.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <Link to={`/plus/wallets/${w.id}`} className="flex flex-col">
              <span className="text-sm text-slate-500">
                {w.icon} {w.name}
              </span>
              <span className="font-semibold">
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
        {recent.length === 0 ? <p className="text-slate-500">{t("home.noTransactions")}</p> : null}
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
      <p className="font-semibold">{value}</p>
    </div>
  );
}
