import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { addDays, addMonths, format, startOfMonth, startOfWeek } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { db } from "../../db/database";
import { TransactionRow } from "../../components/TransactionRow";
import { groupByDay } from "../../domain/grouping";
import { totals } from "../../domain/totals";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { compactAmount } from "../../lib/compact";
import { usePeriodSettings } from "../stats/period-state";

const EMPTY: never[] = [];

/** Calendrier : grille du mois avec le solde net de chaque jour, détail du jour choisi. */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const settings = usePeriodSettings();
  const locale = i18n.language === "en" ? enUS : fr;
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletName = useMemo(() => new Map(wallets.map((w) => [w.id, w.name])), [wallets]);
  const inBase = useMemo(
    () => transactions.filter((tx) => tx.currency === baseCurrency),
    [transactions, baseCurrency],
  );
  const byDay = useMemo(() => new Map(groupByDay(inBase).map((g) => [g.day, g])), [inBase]);

  const weekStart = (settings.weekStartDay ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const gridStart = startOfWeek(cursor, { weekStartsOn: weekStart });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEE", { locale }),
  );
  const monthKey = format(cursor, "yyyy-MM");
  const monthTotals = totals(
    inBase.filter((tx) => format(new Date(tx.date), "yyyy-MM") === monthKey),
  );
  const dayGroup = byDay.get(selected);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-center text-xl font-semibold text-ink dark:text-fg">
        {t("nav.calendar")}
      </h1>

      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t("common.previous")}
          onClick={() => setCursor((c) => addMonths(c, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
        >
          ‹
        </button>
        <p className="font-semibold capitalize text-ink dark:text-fg">
          {format(cursor, "MMMM yyyy", { locale })}
        </p>
        <button
          type="button"
          aria-label={t("common.next")}
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <p className="text-xs text-slate-500 dark:text-muted">{t("home.income")}</p>
          <p className="font-semibold tabular-nums text-income dark:text-income-dark" data-amount>
            {formatMoney(monthTotals.income, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-muted">{t("home.expense")}</p>
          <p className="font-semibold tabular-nums text-expense dark:text-expense-dark" data-amount>
            {formatMoney(monthTotals.expense, baseCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-muted">{t("home.net")}</p>
          <p className="font-semibold tabular-nums text-ink dark:text-fg" data-amount>
            {formatMoney(monthTotals.net, baseCurrency)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-slate-500 dark:text-muted">
        {weekdays.map((name, i) => (
          <span key={`${name}-${i}`} className="capitalize">
            {name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const group = byDay.get(key);
          const inMonth = format(day, "yyyy-MM") === monthKey;
          const isSelected = key === selected;
          const net = group?.net ?? 0;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${format(day, "d MMMM", { locale })}${group ? `, ${formatMoney(net, baseCurrency)}` : ""}`}
              onClick={() => setSelected(key)}
              className={`flex min-h-[52px] flex-col items-center gap-0.5 rounded-xl py-1 text-sm ${
                isSelected ? "bg-ink text-white dark:bg-white dark:text-ink" : ""
              } ${inMonth ? "text-ink dark:text-fg" : "text-slate-400 dark:text-slate-600"}`}
            >
              <span className="tabular-nums">{format(day, "d")}</span>
              {group ? (
                <span
                  className={`max-w-full truncate text-[11px] font-semibold tabular-nums ${
                    isSelected
                      ? "text-white dark:text-ink"
                      : net < 0
                        ? "text-expense dark:text-expense-dark"
                        : "text-income dark:text-income-dark"
                  }`}
                >
                  {compactAmount(net / 100)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-1 rounded-card border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-card">
        <p className="font-semibold capitalize text-ink dark:text-fg">
          {format(new Date(`${selected}T12:00:00`), "EEEE d MMMM yyyy", { locale })}
        </p>
        {!dayGroup || dayGroup.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-muted">
            {t("calendar.empty")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {dayGroup.items.map((tx) => (
              <li key={tx.id}>
                <TransactionRow
                  transaction={tx}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                  walletName={(id) => walletName.get(id ?? "") ?? ""}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
