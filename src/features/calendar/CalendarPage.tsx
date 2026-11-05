import { Icon } from "../../components/Icon";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TransactionDetailSheet } from "../transactions/TransactionDetailSheet";
import { removeTransactions } from "../transactions/transaction-service";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { addDays, addMonths, format, startOfMonth, startOfWeek } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { db } from "../../db/database";
import { TransactionRow } from "../../components/TransactionRow";
import { groupByDay } from "../../domain/grouping";
import { totals } from "../../domain/totals";
import { formatMoney, minorToMajor, type CurrencyCode } from "../../lib/money";
import { compactAmount } from "../../lib/compact";
import { usePeriodSettings } from "../stats/period-state";
import { upTo } from "../../domain/cutoff";
import { useBalanceCutoff } from "../settings/balance-cutoff";

const EMPTY: never[] = [];

/** Calendrier : grille du mois avec le solde net de chaque jour, détail du jour choisi. */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const settings = usePeriodSettings();
  const locale = i18n.language === "en" ? enUS : fr;
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => format(new Date(), "yyyy-MM-dd"));
  // Écran bas : on affiche la semaine du jour choisi, pour que la liste reste assez haute.
  const [folded, setFolded] = useState(() => window.matchMedia("(max-width: 767px), (max-height: 760px)").matches);

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
  const selectedDate = new Date(`${selected}T12:00:00`);
  const visibleStart = folded ? startOfWeek(selectedDate, { weekStartsOn: weekStart }) : gridStart;
  const cells = Array.from({ length: folded ? 7 : 42 }, (_, i) => addDays(visibleStart, i));
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(visibleStart, i), "EEE", { locale }));
  // Flèches : par mois, ou par semaine quand la vue est repliée.
  function shift(direction: -1 | 1) {
    if (folded) {
      const next = addDays(selectedDate, 7 * direction);
      setSelected(format(next, "yyyy-MM-dd"));
      setCursor(startOfMonth(next));
    } else {
      setCursor((c) => addMonths(c, direction));
    }
  }
  const monthKey = format(cursor, "yyyy-MM");
  const calendarCutoff = useBalanceCutoff();
  const monthTotals = totals(
    upTo(
      inBase.filter((tx) => format(new Date(tx.date), "yyyy-MM") === monthKey),
      calendarCutoff,
    ),
  );
  const dayGroup = byDay.get(selected);
  const openTx = openId ? inBase.find((tx) => tx.id === openId) : undefined;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={t("common.previous")}
            onClick={() => shift(-1)}
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
            onClick={() => shift(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-muted">
              <Icon name="arrowUp" className="h-3 w-3" />
              {t("home.income")}
            </p>
            <p className="whitespace-nowrap font-semibold tabular-nums text-income dark:text-income-dark" data-amount>
              {formatMoney(monthTotals.income, baseCurrency)}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-muted">
              <Icon name="arrowDown" className="h-3 w-3" />
              {t("home.expense")}
            </p>
            <p
              className="whitespace-nowrap font-semibold tabular-nums text-expense dark:text-expense-dark"
              data-amount
            >
              {formatMoney(monthTotals.expense, baseCurrency)}
            </p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-muted">
              <Icon name="equal" className="h-3 w-3" />
              {t("calendar.netShort")}
            </p>
            <p className="whitespace-nowrap text-base font-semibold tabular-nums text-ink dark:text-fg" data-amount>
              {formatMoney(monthTotals.net, baseCurrency)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs text-slate-600 dark:text-muted">
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
                onClick={() => {
                  setSelected(key);
                }}
                className={`flex min-h-[44px] flex-col items-center gap-0.5 rounded-xl py-1 text-sm ${
                  isSelected ? "bg-brand-700 text-white dark:bg-brand-300 dark:text-ink" : ""
                } ${inMonth ? "text-ink dark:text-fg" : "text-slate-600 dark:text-muted"}`}
              >
                <span className="tabular-nums">{format(day, "d")}</span>
                {group ? (
                  <span
                    className={`max-w-full truncate text-xs font-semibold tabular-nums ${
                      isSelected
                        ? "text-white dark:text-ink"
                        : net < 0
                          ? "text-expense dark:text-expense-dark"
                          : "text-income dark:text-income-dark"
                    }`}
                  >
                    {compactAmount(minorToMajor(net, baseCurrency))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => setFolded((f) => !f)}
          className="min-h-[44px] self-center rounded-full bg-white px-5 text-sm font-medium text-brand-700 shadow-sm dark:bg-raised dark:text-brand-300"
        >
          {folded ? t("calendar.showMonth") : t("calendar.showWeek")}
        </button>
      </div>

      <section
        id="calendar-day"
        className="flex flex-col gap-1 rounded-card border border-slate-200 bg-white p-3 dark:border-white/15 dark:bg-card"
      >
        <p className="font-semibold capitalize text-ink dark:text-fg">
          {format(new Date(`${selected}T12:00:00`), "EEEE d MMMM yyyy", { locale })}
        </p>
        {!dayGroup || dayGroup.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600 dark:text-muted">
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
                  onOpen={() => setOpenId(tx.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      {openTx ? (
        <TransactionDetailSheet
          transaction={openTx}
          category={openTx.categoryId ? categoryById.get(openTx.categoryId) : undefined}
          walletName={(id) => walletName.get(id ?? "") ?? ""}
          onClose={() => setOpenId(null)}
          onEdit={() => navigate(`/transactions/${openTx.id}/edit`)}
          onDelete={() => {
            if (!window.confirm(t("transactions.confirmDelete", { count: 1 }))) return;
            void removeTransactions([openTx.id]).then(() => setOpenId(null));
          }}
        />
      ) : null}
    </section>
  );
}
