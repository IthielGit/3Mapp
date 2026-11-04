import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { BottomSheet } from "../../components/BottomSheet";
import { Field, buttonSecondary, inputClass } from "../../components/FormControls";
import { useTheme } from "../../lib/theme-context";
import { compactAmount } from "../../lib/compact";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { PeriodPicker, periodLabel } from "./PeriodPicker";
import { currentPeriod, shiftPeriod, usePeriodSettings, type PeriodState } from "./period-state";

/** Donnée principale : quelle question on pose au graphique. */
/** Nom de catégorie raccourci pour tenir dans la colonne des libellés. */
function shortName(name: string): string {
  return name.length > 13 ? `${name.slice(0, 12)}…` : name;
}

type Dataset = "categories" | "weeks" | "balance" | "savings";
/** Représentation : anneau (parts d'un total), barres (comparer), courbe (évolution). */
type Repr = "donut" | "bars" | "line";

/** Représentations valables pour chaque donnée, la première est celle proposée par défaut. */
const REPRS: Record<Dataset, Repr[]> = {
  categories: ["donut", "bars"],
  weeks: ["bars", "line"],
  balance: ["line"],
  savings: ["bars", "line"],
};

const PALETTE = [
  "#1a1a1b",
  "#ee4444",
  "#5c5c64",
  "#8e8e96",
  "#b91c1c",
  "#3f3f45",
  "#d4d4da",
  "#737380",
  "#f08080",
  "#2a2a2e",
];
const EMPTY: never[] = [];

/** Les montants sont en unités mineures ; les graphiques affichent des unités majeures. */
const toMajor = (minor: number) => minor / 100;

export function StatsPage() {
  const { t } = useTranslation();
  const { resolved } = useTheme();
  const settings = usePeriodSettings();
  const [state, setState] = useState<PeriodState>({ kind: "month", anchor: new Date() });
  const [now] = useState(() => new Date());
  const [dataset, setDataset] = useState<Dataset>("categories");
  const [repr, setRepr] = useState<Repr>("donut");
  const [walletFilter, setWalletFilter] = useState<string | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savingsMonths, setSavingsMonths] = useState<3 | 6 | 12>(6);

  const period = currentPeriod(state, settings);
  const previous = previousPeriod(period, state.kind, settings);

  const transactions = useLiveQuery(() => db.transactions.orderBy("date").toArray(), []) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";

  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const walletName = useMemo(() => new Map(wallets.map((w) => [w.id, w.name])), [wallets]);

  // Filtre secondaire : un portefeuille, ou tous.
  const keepWallet = (tx: { walletId: string; toWalletId?: string | undefined }) =>
    walletFilter === undefined || tx.walletId === walletFilter || tx.toWalletId === walletFilter;

  const inPeriod = useMemo(
    () => transactionsIn(transactions, period, baseCurrency).filter(keepWallet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, period, baseCurrency, walletFilter],
  );
  const inPrevious = useMemo(
    () => transactionsIn(transactions, previous, baseCurrency).filter(keepWallet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, previous, baseCurrency, walletFilter],
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
      income: toMajor(totals?.income ?? 0),
      expense: toMajor(totals?.expense ?? 0),
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
  }, [period, now]);
  const scopedWallets =
    walletFilter === undefined ? wallets : wallets.filter((w) => w.id === walletFilter);
  const evolution = useMemo(
    () =>
      balanceEvolution(scopedWallets, transactions, dayKeys, baseCurrency).map((p) => ({
        name: p.day.slice(5),
        balance: toMajor(p.balance),
      })),
    [scopedWallets, transactions, dayKeys, baseCurrency],
  );

  const savingsRows = useMemo(() => {
    const today = new Date();
    return Array.from({ length: savingsMonths }, (_, i) => {
      const from = startOfMonth(addMonths(today, i - savingsMonths + 1));
      const month = { from, to: startOfMonth(addMonths(from, 1)) };
      const sum = periodSummary(
        transactionsIn(transactions, month, baseCurrency).filter(keepWallet),
        month,
      );
      return {
        name: format(from, "MMM yy", { locale: fr }),
        net: toMajor(sum.net),
        income: sum.income,
        expense: sum.expense,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, baseCurrency, savingsMonths, walletFilter]);
  const savingsCumulative = savingsRows.reduce<{ name: string; cumulative: number }[]>(
    (acc, row) => {
      const previous = acc[acc.length - 1]?.cumulative ?? 0;
      return [...acc, { name: row.name, cumulative: previous + row.net }];
    },
    [],
  );
  const savedMinor = savingsRows.reduce((sum, row) => sum + Math.round(row.net * 100), 0);
  const savingsIncome = savingsRows.reduce((sum, row) => sum + row.income, 0);
  const savingsRate =
    savingsIncome > 0 ? Math.round((savedMinor * 1000) / savingsIncome) / 10 : null;

  const categoryData = slices.map((s) => ({ name: s.name, value: toMajor(s.amount) }));
  const top = topExpenses(inPeriod, 10);
  const activeWallets = wallets.filter((w) => !w.archived && w.currency === baseCurrency);

  // Données du graphique principal et valeurs exactes (liste accessible).
  const hasData =
    dataset === "savings"
      ? savingsRows.some((r) => r.income > 0 || r.expense > 0)
      : dataset === "categories"
        ? categoryData.length > 0
        : dataset === "weeks"
          ? weekData.some((w) => w.income > 0 || w.expense > 0)
          : evolution.length > 0;

  const fmt = (value: number) => formatMoney(Math.round(value * 100), baseCurrency);
  const grid = resolved === "dark" ? "#303036" : "#e4e4ea";
  const tick = resolved === "dark" ? "#b8b8c0" : "#5c5c64";

  function chooseDataset(next: Dataset) {
    setDataset(next);
    setRepr(REPRS[next][0] ?? "bars");
  }

  const activeFilterCount = walletFilter === undefined ? 0 : 1;

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-center text-xl font-semibold text-ink dark:text-fg">
        {t("stats.title")}
      </h1>

      {dataset !== "savings" ? (
        <PeriodPicker
          state={state}
          period={period}
          onChange={setState}
          onShift={(d) => setState(shiftPeriod(state, settings, d))}
        />
      ) : null}
      {dataset !== "savings" ? (
        <p className="text-center text-sm text-slate-500 dark:text-muted">{periodLabel(period)}</p>
      ) : null}

      {/* Indicateur principal : le solde net de la période, avec sa variation. */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-slate-500 dark:text-muted">{t("home.net")}</p>
        <p
          className={`text-4xl font-semibold tabular-nums ${
            summary.net < 0 ? "text-accent" : "text-ink dark:text-fg"
          }`}
          data-amount
        >
          {formatMoney(summary.net, baseCurrency)}
        </p>
        {delta(summary.net, before.net) ? (
          <p className="text-xs text-slate-500 dark:text-muted">
            {t("stats.vsPrevious", { change: delta(summary.net, before.net) })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card
          label={t("home.income")}
          value={formatMoney(summary.income, baseCurrency)}
          tone="text-income dark:text-income-dark"
        />
        <Card
          label={t("home.expense")}
          value={formatMoney(summary.expense, baseCurrency)}
          tone="text-expense dark:text-expense-dark"
        />
        <Card
          label={t("stats.savingsRate")}
          value={summary.savingsRate === null ? "—" : `${summary.savingsRate} %`}
        />
      </div>

      {/* Graphique principal : un seul, avec son titre, son unité et son sélecteur compact. */}
      <section
        aria-labelledby="stats-chart-title"
        className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-card"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <h2 id="stats-chart-title" className="font-semibold text-ink dark:text-fg">
              {dataset === "categories"
                ? t("stats.byCategory")
                : dataset === "weeks"
                  ? t("stats.byWeek")
                  : dataset === "savings"
                    ? t("stats.savings")
                    : t("stats.balanceCurve")}
            </h2>
            <span className="text-xs text-slate-500 dark:text-muted">
              {t("stats.unit", { currency: baseCurrency })}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="sr-only" htmlFor="stats-dataset">
              {t("stats.dataset")}
            </label>
            <select
              id="stats-dataset"
              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-raised"
              value={dataset}
              onChange={(e) => chooseDataset(e.target.value as Dataset)}
            >
              <option value="categories">{t("stats.byCategory")}</option>
              <option value="weeks">{t("stats.byWeek")}</option>
              <option value="balance">{t("stats.balanceCurve")}</option>
              <option value="savings">{t("stats.savings")}</option>
            </select>
            {REPRS[dataset].length > 1 ? (
              <div role="radiogroup" aria-label={t("stats.representation")} className="flex gap-1">
                {REPRS[dataset].map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={repr === r}
                    onClick={() => setRepr(r)}
                    className={`min-h-[32px] rounded-full px-3 text-xs font-medium ${
                      repr === r
                        ? "bg-ink text-white dark:bg-white dark:text-ink"
                        : "text-slate-600 dark:text-muted"
                    }`}
                  >
                    {t(`stats.repr.${r}`)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {dataset === "savings" ? (
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label={t("stats.savingsDuration")} className="flex gap-1">
              {([3, 6, 12] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={savingsMonths === n}
                  onClick={() => setSavingsMonths(n)}
                  className={`min-h-[32px] rounded-full px-3 text-xs font-medium ${
                    savingsMonths === n
                      ? "bg-ink text-white dark:bg-white dark:text-ink"
                      : "text-slate-600 dark:text-muted"
                  }`}
                >
                  {t("stats.monthsCount", { count: n })}
                </button>
              ))}
            </div>
            <div className="flex flex-col">
              <p className="text-sm text-slate-500 dark:text-muted">
                {t("stats.savedOver", { count: savingsMonths })}
              </p>
              <p
                className={`text-3xl font-semibold tabular-nums ${savedMinor < 0 ? "text-accent" : "text-income dark:text-income-dark"}`}
                data-amount
              >
                {formatMoney(savedMinor, baseCurrency)}
              </p>
              <p className="text-xs text-slate-500 dark:text-muted">
                {t("stats.savingsRate")} : {savingsRate === null ? "—" : `${savingsRate} %`}
              </p>
            </div>
          </div>
        ) : null}
        {!hasData ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-muted">
            {t("stats.noExpenses")}
          </p>
        ) : (
          <div className="h-64" role="img" aria-label={t("stats.chartAria")}>
            <ResponsiveContainer width="100%" height="100%">
              {dataset === "savings" && repr === "line" ? (
                <LineChart data={savingsCumulative}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} />
                  <YAxis
                    tickFormatter={compactAmount}
                    tick={{ fill: tick, fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#1a1a1b"
                    strokeWidth={2}
                    dot={false}
                    name={t("stats.cumulative")}
                  />
                </LineChart>
              ) : dataset === "savings" ? (
                <BarChart data={savingsRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} />
                  <YAxis
                    tickFormatter={compactAmount}
                    tick={{ fill: tick, fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="net" name={t("stats.savedPerMonth")} radius={[6, 6, 0, 0]}>
                    {savingsRows.map((row) => (
                      <Cell key={row.name} fill={row.net < 0 ? "#ee4444" : "#1a1a1b"} />
                    ))}
                  </Bar>
                </BarChart>
              ) : dataset === "categories" && repr === "donut" ? (
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {categoryData.map((s, i) => (
                      <Cell key={s.name} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              ) : dataset === "categories" ? (
                <BarChart data={categoryData} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={compactAmount}
                    tick={{ fill: tick, fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={104}
                    interval={0}
                    tickFormatter={shortName}
                    tick={{ fill: tick, fontSize: 11 }}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar
                    dataKey="value"
                    name={t("home.expense")}
                    fill="#1a1a1b"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              ) : dataset === "weeks" && repr === "line" ? (
                <LineChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} />
                  <YAxis
                    tickFormatter={compactAmount}
                    tick={{ fill: tick, fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#1a1a1b"
                    name={t("home.income")}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    stroke="#ee4444"
                    name={t("home.expense")}
                    dot={false}
                  />
                </LineChart>
              ) : dataset === "weeks" ? (
                <BarChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} />
                  <YAxis
                    tickFormatter={compactAmount}
                    tick={{ fill: tick, fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend />
                  <Bar
                    dataKey="income"
                    fill="#8e8e96"
                    name={t("home.income")}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    fill="#ee4444"
                    name={t("home.expense")}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              ) : (
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} />
                  <YAxis
                    tickFormatter={compactAmount}
                    tick={{ fill: tick, fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#1a1a1b"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Valeurs exactes : accessibles au clavier et aux lecteurs d'écran. */}
        {hasData ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-ink dark:text-fg">
              {t("stats.values")}
            </summary>
            <table className="mt-2 w-full">
              <tbody>
                {(dataset === "categories"
                  ? categoryData.map((d) => ({ label: d.name, value: d.value }))
                  : dataset === "weeks"
                    ? weekData.map((d) => ({ label: d.name, value: d.expense }))
                    : dataset === "savings"
                      ? savingsRows.map((d) => ({ label: d.name, value: d.net }))
                      : evolution.map((d) => ({ label: d.name, value: d.balance }))
                ).map((row) => (
                  <tr key={row.label} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-1">{row.label}</td>
                    <td className="py-1 text-right tabular-nums" data-amount>
                      {fmt(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
      </section>

      {/* Filtres secondaires, regroupés. */}
      <div className="flex justify-end">
        <button
          type="button"
          className={`${buttonSecondary} relative`}
          onClick={() => setFiltersOpen(true)}
        >
          {t("transactions.filters")}
          {activeFilterCount > 0 ? (
            <span className="ml-2 rounded-full bg-ink px-2 text-xs text-white dark:bg-white dark:text-ink">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-ink dark:text-fg">{t("stats.top10")}</h2>
        <ol className="flex flex-col text-sm">
          {top.map((tx) => (
            <li key={tx.id} className="border-b border-slate-200 dark:border-slate-800">
              <Link to={`/transactions/${tx.id}/edit`} className="flex justify-between py-2">
                <span className="truncate">
                  {tx.memo || names.get(tx.categoryId ?? "") || t("transactions.types.expense")}
                </span>
                <span className="whitespace-nowrap font-medium tabular-nums" data-amount>
                  {formatMoney(tx.amount, tx.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-ink dark:text-fg">{t("stats.byWallet")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-muted">
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
                  <td className="py-1">{walletName.get(w.id) ?? w.name}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(income, w.currency)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(expense, w.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <BottomSheet
        open={filtersOpen}
        title={t("transactions.filters")}
        onClose={() => setFiltersOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <Field label={t("common.wallet")}>
            <select
              className={inputClass}
              value={walletFilter ?? ""}
              onChange={(e) => setWalletFilter(e.target.value || undefined)}
            >
              <option value="">{t("stats.allWallets")}</option>
              {activeWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => setWalletFilter(undefined)}
            >
              {t("transactions.resetFilters")}
            </button>
            <button type="button" className={buttonSecondary} onClick={() => setFiltersOpen(false)}>
              {t("common.save")}
            </button>
          </div>
        </div>
      </BottomSheet>
    </section>
  );
}

/** Variation en pourcentage par rapport à la période précédente ; undefined si la base est nulle. */
function delta(current: number, previous: number): string | undefined {
  if (previous === 0) return undefined;
  const pct = Math.round(((current - previous) * 1000) / Math.abs(previous)) / 10;
  return `${pct > 0 ? "+" : ""}${pct} %`;
}

function Card({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-slate-200 p-3 dark:border-slate-700 dark:bg-card">
      <p className="text-xs text-slate-500 dark:text-muted">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${tone}`} data-amount>
        {value}
      </p>
    </div>
  );
}
