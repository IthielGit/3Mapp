import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  const parentRef = useRef<HTMLDivElement>(null);

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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.kind === "header" ? 40 : 68),
    overscan: 8,
  });

  // Annulation : le bandeau disparaît après 5 secondes.
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undo]);

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
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("transactions.title")}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => setSelectMode((m) => !m)}
            aria-pressed={selectMode}
          >
            {selectMode ? t("transactions.selectDone") : t("transactions.select")}
          </button>
          <button type="button" className={buttonSecondary} onClick={openFilters}>
            {t("transactions.filters")}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </header>

      <input
        type="search"
        className={inputClass}
        placeholder={t("transactions.searchPlaceholder")}
        aria-label={t("transactions.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{t("transactions.count", { count: visible.length })}</span>
        <button
          type="button"
          className="text-brand-700 underline"
          onClick={() => setOldestFirst((o) => !o)}
        >
          {oldestFirst ? t("transactions.sortNewest") : t("transactions.sortOldest")}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <Summary
          label={t("transactions.income")}
          value={formatMoney(summary.income, baseCurrency)}
        />
        <Summary
          label={t("transactions.expense")}
          value={formatMoney(summary.expense, baseCurrency)}
        />
        <Summary label={t("transactions.net")} value={formatMoney(summary.net, baseCurrency)} />
      </div>

      {message ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-slate-500">{t("transactions.empty")}</p>
      ) : null}

      <div
        ref={parentRef}
        className="relative h-[calc(100dvh-22rem)] overflow-y-auto"
        data-testid="transaction-list"
      >
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
                  transform: `translateY(${virtual.start}px)`,
                }}
              >
                {row.kind === "header" ? (
                  <div className="flex items-center justify-between py-2 text-sm font-semibold text-slate-500">
                    <span>{format(new Date(row.day), "EEEE d MMMM", { locale: fr })}</span>
                    <span>{formatMoney(row.net, row.currency)}</span>
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

      {!selectMode ? (
        <Link
          to="/transactions/new"
          aria-label={t("transactions.add")}
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-3xl text-white shadow-lg"
        >
          +
        </Link>
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
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
  const amountText =
    t.type === "transfer"
      ? formatMoney(t.amount, t.currency)
      : `${sign}${formatMoney(t.amount, t.currency)}`;

  return (
    <button
      type="button"
      onClick={selectMode ? onToggle : onOpen}
      className="flex min-h-[60px] w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left dark:border-slate-700"
      aria-pressed={selectMode ? selected : undefined}
    >
      {selectMode ? (
        <span
          aria-hidden="true"
          className={`h-5 w-5 rounded border ${selected ? "bg-brand-700" : ""}`}
        />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{label}</span>
        <span className="truncate text-sm text-slate-500">
          {time}
          {t.memo ? ` · ${t.memo}` : ""}
          {t.type === "transfer" ? "" : ` · ${walletName}`}
        </span>
      </span>
      <span
        className={`whitespace-nowrap font-semibold ${t.type === "income" ? "text-emerald-700 dark:text-emerald-400" : ""}`}
      >
        {amountText}
      </span>
    </button>
  );
}
