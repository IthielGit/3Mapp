import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "../../db/database";
import type { Transaction } from "../../db/entities";
import { BottomSheet } from "../../components/BottomSheet";
import {
  Field,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "../../components/FormControls";
import {
  filterTransactions,
  type TransactionFilters,
  type TransactionType,
} from "../../domain/filters";
import { groupByDay } from "../../domain/grouping";
import { totals } from "../../domain/totals";
import { formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import {
  bulkUpdate,
  removeTransactions,
  restoreTransactions,
  type TransactionDraft,
  type RemovedBundle,
} from "./transaction-service";
import { TransactionSheet } from "./TransactionSheet";

const ALL_TYPES: TransactionType[] = ["expense", "income", "transfer", "adjustment"];
type Period = "all" | "month" | "thirty";

interface Undo {
  bundle: RemovedBundle;
}

type Row =
  | { kind: "header"; key: string; day: string; net: number; currency: CurrencyCode }
  | { kind: "item"; key: string; transaction: Transaction };

const EMPTY: never[] = [];

export function TransactionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [params] = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const baseCurrency =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [period, setPeriod] = useState<Period>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TransactionFilters>({});
  const [draftPeriod, setDraftPeriod] = useState<Period>("all");
  const [oldestFirst, setOldestFirst] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkWallet, setBulkWallet] = useState("");
  const [undo, setUndo] = useState<Undo | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const walletName = useMemo(() => new Map(wallets.map((w) => [w.id, w.name])), [wallets]);

  const periodBounds = useMemo(() => {
    const now = new Date();
    if (period === "month") {
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    }
    if (period === "thirty") return { from: subDays(now, 30).toISOString(), to: now.toISOString() };
    return {};
  }, [period]);

  const visible = useMemo(() => {
    const filtered = filterTransactions(
      transactions,
      { ...filters, ...periodBounds, query },
      categoryNames,
    );
    return oldestFirst ? [...filtered].reverse() : filtered;
  }, [transactions, filters, periodBounds, query, categoryNames, oldestFirst]);

  const summary = useMemo(
    () => totals(visible.filter((t) => t.currency === baseCurrency)),
    [visible, baseCurrency],
  );

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const group of groupByDay(visible)) {
      out.push({
        kind: "header",
        key: `h-${group.day}`,
        day: group.day,
        net: group.net,
        currency: baseCurrency,
      });
      for (const transaction of group.items) {
        out.push({ kind: "item", key: transaction.id, transaction });
      }
    }
    return out;
  }, [visible, baseCurrency]);

  // Une seule zone de défilement : la fenêtre. La liste mesure sa position dans la page pour que
  // la virtualisation sache où elle commence.
  useLayoutEffect(() => {
    const measure = () =>
      setScrollMargin((listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rows.length]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) => (rows[index]?.kind === "header" ? 44 : 68),
    overscan: 8,
    scrollMargin,
  });

  // Annulation : le bandeau disparaît après 5 secondes.
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  function resetAll() {
    setFilters({});
    setPeriod("all");
  }

  const sheetMode = location.pathname.endsWith("/new") ? "new" : id ? "edit" : null;
  const editing = sheetMode === "edit" ? transactions.find((t) => t.id === id) : undefined;
  const defaultType = params.get("type") as TransactionType | null;

  function closeSheet() {
    navigate("/transactions", { replace: true });
  }

  async function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(t("transactions.confirmDelete", { count: ids.length }))) return;
    const removed = await removeTransactions(ids);
    setUndo({ bundle: removed });
    setSelected(new Set());
    setSelectMode(false);
  }

  async function runUndo() {
    if (!undo) return;
    await restoreTransactions(undo.bundle);
    setUndo(null);
  }

  async function applyBulk(change: (draft: TransactionDraft) => TransactionDraft) {
    setMessage(undefined);
    try {
      await bulkUpdate([...selected], change);
      setSelected(new Set());
      setSelectMode(false);
      setMessage(t("transactions.bulkDone"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  function toggleSelected(txId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  }

  function openFilters() {
    setDraftFilters(filters);
    setDraftPeriod(period);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setPeriod(draftPeriod);
    setFiltersOpen(false);
  }

  function resetFilters() {
    setDraftFilters({});
    setDraftPeriod("all");
  }

  const activeFilterCount =
    (filters.types?.length ?? 0) +
    (filters.walletId ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.minAmount !== undefined ? 1 : 0) +
    (filters.maxAmount !== undefined ? 1 : 0) +
    (period !== "all" ? 1 : 0);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[#172033] dark:text-slate-100">
          {t("transactions.title")}
        </h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openFilters}
            aria-label={t("transactions.filters")}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-[#64748B] active:bg-slate-100 dark:text-slate-400"
          >
            <FilterIcon />
            {activeFilterCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0F8178] px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setSelectMode((m) => !m)}
            aria-pressed={selectMode}
            className={`min-h-[44px] rounded-xl px-3 text-sm font-semibold ${
              selectMode ? "bg-[#0F8178] text-white" : "text-[#0F8178] dark:text-teal-300"
            }`}
          >
            {selectMode ? t("transactions.selectDone") : t("transactions.select")}
          </button>
        </div>
      </header>

      <label className="relative block">
        <span className="sr-only">{t("transactions.search")}</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748B]" />
        <input
          type="search"
          className="h-[46px] w-full rounded-xl border border-[#E2E8F0] bg-white pl-10 pr-3 text-base text-[#172033] placeholder:text-[#64748B] focus:border-[#0F8178] focus:outline-none focus:ring-2 focus:ring-[#0F8178]/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder={t("transactions.searchPlaceholder")}
          aria-label={t("transactions.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-[#64748B] dark:text-slate-400">
          {t("transactions.count", { count: visible.length })}
        </span>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 ? (
            <button
              type="button"
              className="font-medium text-[#0F8178] dark:text-teal-300"
              onClick={resetAll}
            >
              {t("transactions.resetFilters")}
            </button>
          ) : null}
          <button
            type="button"
            className="font-medium text-[#0F8178] dark:text-teal-300"
            onClick={() => setOldestFirst((o) => !o)}
          >
            {oldestFirst ? t("transactions.sortNewest") : t("transactions.sortOldest")}
          </button>
        </div>
      </div>

      <section
        aria-label={t("transactions.summary")}
        className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex flex-col">
          <p className="text-sm text-[#64748B] dark:text-slate-400">{t("transactions.net")}</p>
          <p
            className={`text-3xl font-bold tabular-nums ${
              summary.net < 0
                ? "text-[#DC2626] dark:text-red-400"
                : summary.net > 0
                  ? "text-[#15803D] dark:text-emerald-400"
                  : "text-[#172033] dark:text-slate-100"
            }`}
            data-amount
          >
            {formatMoney(summary.net, baseCurrency)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#E2E8F0] pt-3 text-sm dark:border-slate-700">
          <div className="flex flex-col">
            <p className="text-[#64748B] dark:text-slate-400">{t("transactions.income")}</p>
            <p
              className="font-semibold tabular-nums text-[#15803D] dark:text-emerald-400"
              data-amount
            >
              {formatMoney(summary.income, baseCurrency)}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-[#64748B] dark:text-slate-400">{t("transactions.expense")}</p>
            <p className="font-semibold tabular-nums text-[#DC2626] dark:text-red-400" data-amount>
              {formatMoney(summary.expense, baseCurrency)}
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-slate-500">{t("transactions.empty")}</p>
      ) : null}

      <div ref={listRef} className="relative" data-testid="transaction-list">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((virtual) => {
            const row = rows[virtual.index];
            if (!row) return null;
            return (
              <div
                key={row.key}
                data-index={virtual.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtual.start - scrollMargin}px)`,
                }}
              >
                {row.kind === "header" ? (
                  <div className="flex items-center justify-between gap-3 pb-1 pt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold tabular-nums text-[#172033] dark:text-slate-100">
                        {format(new Date(row.day), "dd")}
                      </span>
                      <span className="text-sm capitalize text-[#64748B] dark:text-slate-400">
                        {format(new Date(row.day), "EEEE, MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                    <span
                      className="text-sm tabular-nums text-[#64748B] dark:text-slate-400"
                      data-amount
                    >
                      {formatMoney(row.net, row.currency)}
                    </span>
                  </div>
                ) : (
                  <TransactionRow
                    transaction={row.transaction}
                    walletName={walletName.get(row.transaction.walletId) ?? ""}
                    toWalletName={
                      row.transaction.toWalletId
                        ? (walletName.get(row.transaction.toWalletId) ?? "")
                        : ""
                    }
                    categoryName={
                      row.transaction.categoryId
                        ? (categoryNames.get(row.transaction.categoryId) ?? "")
                        : ""
                    }
                    selectMode={selectMode}
                    selected={selected.has(row.transaction.id)}
                    onToggle={() => toggleSelected(row.transaction.id)}
                    onOpen={() => navigate(`/transactions/${row.transaction.id}/edit`)}
                    time={format(new Date(row.transaction.date), "HH:mm")}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectMode ? (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-lg flex-col gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm">{t("transactions.selectedCount", { count: selected.size })}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={buttonDanger}
              disabled={selected.size === 0}
              onClick={() => void deleteIds([...selected])}
            >
              {t("common.delete")}
            </button>
            <button
              type="button"
              className={buttonSecondary}
              disabled={selected.size === 0}
              onClick={() =>
                void applyBulk((d) => ({
                  ...d,
                  categoryId: bulkCategory || undefined,
                  subcategoryId: undefined,
                }))
              }
            >
              {t("transactions.setCategory")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputClass}
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              aria-label={t("transactions.setCategory")}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                className={inputClass}
                value={bulkWallet}
                onChange={(e) => setBulkWallet(e.target.value)}
                aria-label={t("transactions.setWallet")}
              >
                <option value="">—</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={buttonSecondary}
                disabled={selected.size === 0 || !bulkWallet}
                onClick={() => void applyBulk((d) => ({ ...d, walletId: bulkWallet }))}
              >
                {t("transactions.setWallet")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {undo ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg bg-slate-900 px-4 py-3 text-white"
        >
          <span>{t("transactions.deleted", { count: undo.bundle.transactions.length })}</span>
          <button
            type="button"
            className="min-h-[44px] font-semibold underline"
            onClick={() => void runUndo()}
          >
            {t("common.undo")}
          </button>
        </div>
      ) : null}

      {filtersOpen ? (
        <BottomSheet open title={t("transactions.filters")} onClose={() => setFiltersOpen(false)}>
          <div className="flex flex-col gap-4">
            <Field label={t("transactions.period")}>
              <select
                className={inputClass}
                value={draftPeriod}
                onChange={(e) => setDraftPeriod(e.target.value as Period)}
              >
                <option value="all">{t("transactions.periodAll")}</option>
                <option value="month">{t("transactions.periodMonth")}</option>
                <option value="thirty">{t("transactions.period30")}</option>
              </select>
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("transactions.type")}</legend>
              {ALL_TYPES.map((tp) => {
                const checked = draftFilters.types?.includes(tp) ?? false;
                return (
                  <label key={tp} className="flex min-h-[44px] items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={checked}
                      onChange={(e) =>
                        setDraftFilters((f) => {
                          const current = f.types ?? [];
                          const types = e.target.checked
                            ? [...current, tp]
                            : current.filter((x) => x !== tp);
                          return { ...f, types };
                        })
                      }
                    />
                    {t(`transactions.types.${tp}`)}
                  </label>
                );
              })}
            </fieldset>

            <Field label={t("transactions.wallet")}>
              <select
                className={inputClass}
                value={draftFilters.walletId ?? ""}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, walletId: e.target.value || undefined }))
                }
              >
                <option value="">{t("transactions.anyWallet")}</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("common.category")}>
              <select
                className={inputClass}
                value={draftFilters.categoryId ?? ""}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, categoryId: e.target.value || undefined }))
                }
              >
                <option value="">{t("transactions.anyCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t("transactions.minAmount")}>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  defaultValue=""
                  onBlur={(e) => {
                    const value =
                      e.target.value.trim() === ""
                        ? undefined
                        : (parseMoney(e.target.value, baseCurrency) ?? undefined);
                    setDraftFilters((f) => ({ ...f, minAmount: value }));
                  }}
                />
              </Field>
              <Field label={t("transactions.maxAmount")}>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  defaultValue=""
                  onBlur={(e) => {
                    const value =
                      e.target.value.trim() === ""
                        ? undefined
                        : (parseMoney(e.target.value, baseCurrency) ?? undefined);
                    setDraftFilters((f) => ({ ...f, maxAmount: value }));
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={buttonSecondary} onClick={resetFilters}>
                {t("transactions.reset")}
              </button>
              <button type="button" className={buttonPrimary} onClick={applyFilters}>
                {t("transactions.apply")}
              </button>
            </div>
          </div>
        </BottomSheet>
      ) : null}

      {sheetMode ? (
        <TransactionSheet
          key={sheetMode === "edit" ? `edit-${id}` : `new-${defaultType ?? ""}`}
          transaction={editing}
          defaultType={defaultType ?? undefined}
          onClose={closeSheet}
          onDelete={(tx) => {
            void deleteIds([tx.id]).then(closeSheet);
          }}
        />
      ) : null}
    </section>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
  walletName: string;
  toWalletName: string;
  categoryName: string;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  time: string;
}

function TransactionRow({
  transaction: t,
  walletName,
  toWalletName,
  categoryName,
  selectMode,
  selected,
  onToggle,
  onOpen,
  time,
}: TransactionRowProps) {
  const { t: translate } = useTranslation();
  const label =
    t.type === "transfer"
      ? `${walletName} → ${toWalletName}`
      : categoryName || translate(`transactions.types.${t.type}`);
  const sign = t.type === "income" || (t.type === "adjustment" && t.amount > 0) ? "+" : "";

  const amountClass =
    t.type === "expense"
      ? "text-[#DC2626] dark:text-red-400"
      : t.type === "income"
        ? "text-[#15803D] dark:text-emerald-400"
        : "text-[#172033] dark:text-slate-100";
  const details = [time, t.memo, t.type === "transfer" ? "" : walletName]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={selectMode ? onToggle : onOpen}
      className="flex min-h-[56px] w-full items-center gap-3 border-b border-[#E2E8F0] py-2.5 text-left active:bg-slate-100 dark:border-slate-800 dark:active:bg-slate-800/60"
      aria-pressed={selectMode ? selected : undefined}
    >
      {selectMode ? (
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            selected ? "border-[#0F8178] bg-[#0F8178] text-white" : "border-[#64748B]"
          }`}
        >
          {selected ? "✓" : null}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-[#172033] dark:text-slate-100">
          {label}
        </span>
        <span className="truncate text-sm text-[#64748B] dark:text-slate-400">{details}</span>
      </span>
      <span
        className={`shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums ${amountClass}`}
        data-amount
      >
        {t.type === "expense" ? "−" : sign}
        {formatMoney(t.amount, t.currency)}
      </span>
    </button>
  );
}

/** Icônes en SVG, sans bibliothèque : trait fin, couleur héritée du texte. */
function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}
