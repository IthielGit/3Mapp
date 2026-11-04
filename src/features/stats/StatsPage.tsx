import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "../../db/database";
import {
  balanceEvolution,
  bucketTotals,
  expenseByCategory,
  periodSummary,
  topExpenses,
  transactionsIn,
} from "../../domain/stats";
import { contains, localDayKey, previousPeriod, splitPeriods } from "../../domain/period";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { PeriodPicker, periodLabel } from "./PeriodPicker";
import { currentPeriod, shiftPeriod, usePeriodSettings, type PeriodState } from "./period-state";

const PALETTE = [
  "#1e40af",
  "#0369a1",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#475569",
  "#0891b2",
  "#64748b",
];
const EMPTY: never[] = [];

export function StatsPage() {
  const { t } = useTranslation();
  const settings = usePeriodSettings();
  const [state, setState] = useState<PeriodState>({ kind: "month", anchor: new Date() });
  const [drillCategory, setDrillCategory] = useState<string | null | undefined>(undefined);
  const [now] = useState(() => new Date());

  const period = currentPeriod(state, settings);
  const previous = previousPeriod(
    period,
    state.kind === "custom" ? "custom" : state.kind,
    settings,
  );

  const transactions = useLiveQuery(() => db.transactions.orderBy("date").toArray(), []) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";

  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const walletName = useMemo(() => new Map(wallets.map((w) => [w.id, w.name])), [wallets]);
  const inPeriod = useMemo(
    () => transactionsIn(transactions, period, baseCurrency),
    [transactions, period, baseCurrency],
  );
  const inPrevious = useMemo(
    () => transactionsIn(transactions, previous, baseCurrency),
    [transactions, previous, baseCurrency],
  );

  const summary = periodSummary(inPeriod, period);
  const before = periodSummary(inPrevious, previous);
  const slices = expenseByCategory(inPeriod, names, t("stats.uncategorised"));
  const weeks = useMemo(() => splitPeriods(period, "week", settings), [period, settings]);
  const weekData = weeks.map((w, i) => {
    const txs = inPeriod.filter((tx) => contains(w, tx.date));
    const totals = bucketTotals(txs, () => "w", ["w"])[0];
    return {
      name: `S${i + 1}`,
      income: (totals?.income ?? 0) / 100,
      expense: (totals?.expense ?? 0) / 100,
    };
  });
  const monthPeriods = splitPeriods(
    {
      from: new Date(period.from.getFullYear(), 0, 1),
      to: new Date(period.from.getFullYear() + 1, 0, 1),
    },
    "month",
    settings,
  );
  const monthData = monthPeriods.map((m) => {
    const txs = transactions.filter((tx) => tx.currency === baseCurrency && contains(m, tx.date));
    const totals = bucketTotals(txs, () => "m", ["m"])[0];
    return {
      name: format(m.from, "MMM", { locale: fr }),
      income: (totals?.income ?? 0) / 100,
      expense: (totals?.expense ?? 0) / 100,
    };
  });

  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    const end = Math.min(period.to.getTime(), now.getTime());
    for (
      let d = new Date(period.from);
      d.getTime() < end;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
      keys.push(localDayKey(d.toISOString()));
    }
    return keys;
  }, [period]);
  const evolution = useMemo(
    () =>
      balanceEvolution(wallets, transactions, dayKeys, baseCurrency).map((p) => ({
        name: p.day.slice(5),
        balance: p.balance / 100,
      })),
    [wallets, transactions, dayKeys, baseCurrency],
  );

  const top = topExpenses(inPeriod, 10);
  const drilled =
    drillCategory === undefined
      ? []
      : inPeriod.filter((tx) => tx.type === "expense" && (tx.categoryId ?? null) === drillCategory);
  const activeWallets = wallets.filter((w) => !w.archived && w.currency === baseCurrency);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("stats.title")}</h1>

      <PeriodPicker
        state={state}
        period={period}
        onChange={setState}
        onShift={(d) => setState(shiftPeriod(state, settings, d))}
      />
      <p className="text-center text-sm text-slate-500">{periodLabel(period)}</p>

      <div className="grid grid-cols-2 gap-2">
        <Card
          label={t("home.income")}
          value={formatMoney(summary.income, baseCurrency)}
          delta={delta(summary.income, before.income)}
          tone="text-income dark:text-income-dark"
        />
        <Card
          label={t("home.expense")}
          value={formatMoney(summary.expense, baseCurrency)}
          delta={delta(summary.expense, before.expense)}
          tone="text-expense dark:text-expense-dark"
        />
        <Card label={t("home.net")} value={formatMoney(summary.net, baseCurrency)} />
        <Card
          label={t("stats.savingsRate")}
          value={summary.savingsRate === null ? "—" : `${summary.savingsRate} %`}
        />
        <Card
          label={t("stats.dailyAverage")}
          value={formatMoney(summary.dailyExpenseAverage, baseCurrency)}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("stats.byCategory")}</h2>
        {slices.length === 0 ? (
          <p className="text-slate-500">{t("stats.noExpenses")}</p>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="amount" nameKey="name" outerRadius={90}>
                    {slices.map((s, i) => (
                      <Cell key={s.name} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v), baseCurrency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {slices.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full justify-between"
                    onClick={() => setDrillCategory(s.categoryId)}
                  >
                    <span>{s.name}</span>
                    <span>
                      {formatMoney(s.amount, baseCurrency)} · {s.share} %
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {drillCategory !== undefined ? (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex justify-between">
              <h3 className="font-medium">
                {drillCategory === null ? t("stats.uncategorised") : names.get(drillCategory)}
              </h3>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => setDrillCategory(undefined)}
              >
                {t("common.cancel")}
              </button>
            </div>
            {drilled.map((tx) => (
              <Link
                key={tx.id}
                to={`/transactions/${tx.id}/edit`}
                className="flex justify-between text-sm"
              >
                <span>
                  {format(new Date(tx.date), "dd/MM HH:mm")} ·{" "}
                  {tx.memo || walletName.get(tx.walletId)}
                </span>
                <span>{formatMoney(tx.amount, tx.currency)}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("stats.byWeek")}</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="income" fill="#059669" name={t("home.income")} />
              <Bar dataKey="expense" fill="#dc2626" name={t("home.expense")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("stats.byMonth", { year: period.from.getFullYear() })}</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="income" fill="#059669" name={t("home.income")} />
              <Bar dataKey="expense" fill="#dc2626" name={t("home.expense")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("stats.balanceCurve")}</h2>
        {evolution.length === 0 ? (
          <p className="text-slate-500">{t("stats.noExpenses")}</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="balance" stroke="#1e40af" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("stats.top10")}</h2>
        <ol className="flex flex-col gap-1 text-sm">
          {top.map((tx) => (
            <li key={tx.id}>
              <Link to={`/transactions/${tx.id}/edit`} className="flex justify-between">
                <span>
                  {tx.memo || names.get(tx.categoryId ?? "") || t("transactions.types.expense")}
                </span>
                <span>{formatMoney(tx.amount, tx.currency)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("stats.byWallet")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">{t("common.name")}</th>
              <th className="py-1 text-right">{t("home.income")}</th>
              <th className="py-1 text-right">{t("home.expense")}</th>
            </tr>
          </thead>
          <tbody>
            {activeWallets.map((w) => {
              const own = inPeriod.filter((tx) => tx.walletId === w.id);
              const income = own
                .filter((tx) => tx.type === "income")
                .reduce((a, tx) => a + tx.amount, 0);
              const expense = own
                .filter((tx) => tx.type === "expense")
                .reduce((a, tx) => a + tx.amount, 0);
              return (
                <tr key={w.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1">{w.name}</td>
                  <td className="py-1 text-right">{formatMoney(income, w.currency)}</td>
                  <td className="py-1 text-right">{formatMoney(expense, w.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </section>
  );
}

/** Variation en pourcentage par rapport à la période précédente ; null si la base est nulle. */
function delta(current: number, previous: number): string | undefined {
  if (previous === 0) return undefined;
  const pct = Math.round(((current - previous) * 1000) / Math.abs(previous)) / 10;
  return `${pct > 0 ? "+" : ""}${pct} %`;
}

function Card({
  label,
  value,
  delta: change,
  tone = "",
}: {
  label: string;
  value: string;
  delta?: string | undefined;
  tone?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 rounded-card border border-slate-200 p-3 shadow-sm dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-semibold ${tone}`} data-amount>
        {value}
      </p>
      {change ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("stats.vsPrevious", { change })}
        </p>
      ) : null}
    </div>
  );
}
