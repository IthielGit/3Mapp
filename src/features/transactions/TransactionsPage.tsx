import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "../../db/database";
import { byName } from "../../lib/compare";
import type { Transaction } from "../../db/entities";
import { BottomSheet } from "../../components/BottomSheet";
import { AccountMenu } from "../../components/AccountMenu";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import {
  filterTransactions,
  type TransactionFilters,
  type TransactionType,
} from "../../domain/filters";
import { groupByDay } from "../../domain/grouping";
import { totals } from "../../domain/totals";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { parseAmountText } from "../../lib/amount-entry";
import { AmountTextInput } from "../../components/AmountTextInput";
import {
  bulkUpdate,
  removeTransactions,
  restoreTransactions,
  type TransactionDraft,
  type RemovedBundle,
} from "./transaction-service";
import { TransactionSheet } from "./TransactionSheet";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import { upTo } from "../../domain/cutoff";
import { useBalanceCutoff } from "../settings/balance-cutoff";
import { askConfirm } from "../../components/confirm-service";
import { announce } from "../../components/announce";

const ALL_TYPES: TransactionType[] = ["expense", "income", "transfer", "adjustment"];
type Period = "all" | "month" | "thirty";

/** Période affichée à l'ouverture et après réinitialisation : le mois en cours. */
const DEFAULT_PERIOD: Period = "month";

interface Undo {
  bundle: RemovedBundle;
}

type Row =
  | { kind: "header"; key: string; day: string; net: number; currency: CurrencyCode; ids: string[] }
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
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TransactionFilters>({});
  const [draftPeriod, setDraftPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [oldestFirst, setOldestFirst] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWallet, setBulkWallet] = useState("");
  const [bulkSheet, setBulkSheet] = useState<"category" | "wallet" | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
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

  const totalsCutoff = useBalanceCutoff();
  const summary = useMemo(
    () =>
      totals(
        upTo(
          visible.filter((t) => t.currency === baseCurrency),
          totalsCutoff,
        ),
      ),
    [visible, baseCurrency, totalsCutoff],
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
        ids: group.items.map((transaction) => transaction.id),
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
    setPeriod(DEFAULT_PERIOD);
  }

  const sheetMode = location.pathname.endsWith("/new")
    ? "new"
    : id
      ? location.pathname.endsWith("/edit")
        ? "edit"
        : "view"
      : null;
  // Lecture directe en base : la feuille de saisie ne s'ouvre qu'avec la transaction chargée.
  const target = useLiveQuery(() => (id ? db.transactions.get(id) : undefined), [id]);
  const editing = sheetMode === "edit" ? (target ?? undefined) : undefined;
  const defaultType = params.get("type") as TransactionType | null;
  const copyFromId = params.get("from");
  const copySource = useLiveQuery(
    () => (copyFromId ? db.transactions.get(copyFromId) : undefined),
    [copyFromId],
  );

  function closeSheet() {
    // Nouvelle saisie ouverte depuis un autre écran (accueil, « + ») : on y retourne, pour que
    // la saisie apparaisse là où l'utilisateur l'a lancée. Ouverture directe (raccourci d'app,
    // lien) ou copie d'une transaction : la liste des transactions, comme avant.
    if (sheetMode === "new" && !copyFromId && location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate("/transactions", { replace: true });
  }

  async function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    if (!(await askConfirm({ message: t("transactions.confirmDelete", { count: ids.length }) })))
      return;
    const removed = await removeTransactions(ids);
    setUndo({ bundle: removed });
    setSelected(new Set());
    setSelectMode(false);
    announce(t("a11y.deleted"));
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

  // Tout sélectionner : porte sur les transactions visibles (filtres et recherche appliqués).
  const allVisibleSelected = visible.length > 0 && visible.every((tx) => selected.has(tx.id));
  function toggleAllVisible() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((tx) => tx.id)));
  }

  // Une date : toutes ses transactions visibles. Si elles sont déjà toutes choisies, on les retire.
  function toggleDay(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allChosen = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allChosen) next.delete(id);
        else next.add(id);
      }
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
    setDraftPeriod(DEFAULT_PERIOD);
  }

  const activeFilterCount =
    (filters.types?.length ?? 0) +
    (filters.walletId ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.minAmount !== undefined ? 1 : 0) +
    (filters.maxAmount !== undefined ? 1 : 0) +
    (period !== DEFAULT_PERIOD ? 1 : 0);

  return (
    <section className="flex flex-col gap-4">
      {/* Haut de page collé : titre, recherche, compte et résumé restent visibles pendant le défilement de la liste. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-2 bg-canvas px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-page">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink dark:text-fg">{t("transactions.title")}</h1>
          <AccountMenu />
        </header>

        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">{t("transactions.search")}</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />
            <input
              type="search"
              className="h-[46px] w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-base text-ink placeholder:text-neutral-600 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-white/15 dark:bg-card dark:text-fg"
              placeholder={t("transactions.searchPlaceholder")}
              aria-label={t("transactions.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={openFilters}
            aria-label={t("transactions.filters")}
            className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 dark:border-white/15 dark:bg-card dark:text-muted"
          >
            <FilterIcon />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-neutral-600 dark:text-muted">
            {t("transactions.count", { count: visible.length })}
          </span>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 ? (
              <button
                type="button"
                className="font-medium text-brand-700 dark:text-brand-dark"
                onClick={resetAll}
              >
                {t("transactions.resetFilters")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectMode((m) => !m)}
              aria-pressed={selectMode}
              className={`min-h-[44px] rounded-xl px-3 font-semibold ${
                selectMode ? "bg-brand-600 text-white" : "text-brand-700 dark:text-brand-dark"
              }`}
            >
              {selectMode ? t("transactions.selectDone") : t("transactions.select")}
            </button>
          </div>
        </div>

        {/* Résumé compact : solde du mois sur une ligne, revenus et dépenses en dessous. */}
        <section
          aria-label={t("transactions.summary")}
          className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-white/15 dark:bg-card"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm text-neutral-600 dark:text-muted">{`${t("transactions.net")} ${t(`transactions.netWhen.${period}`)}`}</p>
            <p
              className={`text-xl font-semibold tabular-nums ${
                summary.net < 0
                  ? "text-expense dark:text-expense-dark"
                  : summary.net > 0
                    ? "text-income dark:text-income-dark"
                    : "text-ink dark:text-fg"
              }`}
              data-amount
            >
              {formatMoney(summary.net, baseCurrency)}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
            <p className="text-neutral-600 dark:text-muted">
              {t("transactions.income")}{" "}
              <span className="font-semibold text-income dark:text-income-dark" data-amount>
                {formatMoney(summary.income, baseCurrency)}
              </span>
            </p>
            <p className="text-neutral-600 dark:text-muted">
              {t("transactions.expense")}{" "}
              <span className="font-semibold text-expense dark:text-expense-dark" data-amount>
                {formatMoney(summary.expense, baseCurrency)}
              </span>
            </p>
          </div>
        </section>
      </div>

      {message ? (
        <p role="status" className="text-sm text-neutral-600 dark:text-muted">
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-neutral-600 dark:text-muted">
          {query.trim()
            ? t("transactions.noSearchResults", { query: query.trim() })
            : t("transactions.empty")}
        </p>
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
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-raised">
                    <div className="flex items-center gap-3">
                      {selectMode ? (
                        <DaySelectCheckbox
                          label={t("transactions.selectDay", {
                            date: format(new Date(row.day), "d MMMM yyyy", { locale: fr }),
                          })}
                          checked={row.ids.length > 0 && row.ids.every((id) => selected.has(id))}
                          mixed={row.ids.some((id) => selected.has(id)) && !row.ids.every((id) => selected.has(id))}
                          onToggle={() => toggleDay(row.ids)}
                        />
                      ) : null}
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-base font-semibold tabular-nums text-ink shadow-sm dark:bg-card dark:text-fg">
                        {format(new Date(row.day), "dd")}
                      </span>
                      <span className="text-sm font-semibold text-neutral-600 dark:text-muted">
                        {format(new Date(row.day), "EEEE, MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums text-ink opacity-60 dark:text-fg"
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
                    categoryIcon={
                      row.transaction.categoryId
                        ? categoryById.get(row.transaction.categoryId)?.icon
                        : undefined
                    }
                    categoryColor={
                      row.transaction.categoryId
                        ? categoryById.get(row.transaction.categoryId)?.color
                        : undefined
                    }
                    selectMode={selectMode}
                    selected={selected.has(row.transaction.id)}
                    onToggle={() => toggleSelected(row.transaction.id)}
                    onOpen={() => navigate(`/transactions/${row.transaction.id}`)}
                    time={format(new Date(row.transaction.date), "HH:mm")}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Barre d'actions de sélection : remplace la barre basse (et le bouton « + ») pendant la sélection. */}
      {selectMode ? (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg flex-col gap-3 rounded-t-2xl border-t border-neutral-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] dark:border-white/15 dark:bg-card">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectMode(false)}
              aria-label={t("common.close")}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-neutral-100 dark:text-fg dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <p className="min-w-0 flex-1 text-sm font-semibold text-ink dark:text-fg" aria-live="polite">
              {t("transactions.selectedCount", { count: selected.size })}
            </p>
            <button
              type="button"
              onClick={toggleAllVisible}
              disabled={visible.length === 0}
              className="min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-semibold text-brand-700 disabled:opacity-50 dark:text-brand-dark"
            >
              {allVisibleSelected ? t("transactions.deselectAll") : t("transactions.selectAll")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-neutral-500 px-2 text-sm font-medium disabled:opacity-50 dark:border-white/15"
              disabled={selected.size === 0}
              onClick={() => {
                setBulkWallet("");
                setBulkSheet("wallet");
              }}
            >
              {t("common.wallet")}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-red-300 px-2 text-sm font-semibold text-expense disabled:opacity-50 dark:border-red-400/30"
              disabled={selected.size === 0}
              onClick={() => void deleteIds([...selected])}
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Feuille de modification groupée : portefeuille, puis Appliquer. */}
      {bulkSheet === "wallet" ? (
        <BottomSheet open title={t("transactions.setWallet")} onClose={() => setBulkSheet(null)}>
          <div className="flex flex-col gap-4">
            <Field label={t("common.wallet")}>
              <select
                className={inputClass}
                value={bulkWallet}
                onChange={(e) => setBulkWallet(e.target.value)}
              >
                <option value="">—</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              className={buttonPrimary}
              disabled={!bulkWallet}
              onClick={() => {
                setBulkSheet(null);
                void applyBulk((d) => ({ ...d, walletId: bulkWallet }));
              }}
            >
              {t("transactions.apply")}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {undo ? (
        <div
          role="status"
          className="undo-toast fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg bg-neutral-900 px-4 py-3 text-white"
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
        <BottomSheet
          open
          title={t("transactions.filters")}
          onClose={() => setFiltersOpen(false)}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={buttonSecondary} onClick={resetFilters}>
                {t("transactions.reset")}
              </button>
              <button type="button" className={buttonPrimary} onClick={applyFilters}>
                {t("transactions.apply")}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-5">
            {/* Période et tri côte à côte : deux réglages courts, une seule ligne. */}
            <div className="grid grid-cols-2 gap-2">
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
              {/* Le tri est ici (et non plus sur la ligne de compte) : moins d'icônes à déchiffrer. */}
              <Field label={t("transactions.sort")}>
                <select
                  className={inputClass}
                  value={oldestFirst ? "oldest" : "newest"}
                  onChange={(e) => setOldestFirst(e.target.value === "oldest")}
                >
                  <option value="newest">{t("transactions.sortNewest")}</option>
                  <option value="oldest">{t("transactions.sortOldest")}</option>
                </select>
              </Field>
            </div>

            {/* Types en puces activables : une seule rangée au lieu de quatre cases à cocher. */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-2 text-sm font-medium">{t("transactions.type")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {ALL_TYPES.map((tp) => {
                  const pressed = draftFilters.types?.includes(tp) ?? false;
                  return (
                    <button
                      key={tp}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() =>
                        setDraftFilters((f) => {
                          const current = f.types ?? [];
                          const types = pressed
                            ? current.filter((x) => x !== tp)
                            : [...current, tp];
                          return { ...f, types };
                        })
                      }
                      className={`min-h-[44px] rounded-xl border px-3 text-sm font-medium transition-colors ${
                        pressed
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-neutral-500 bg-white text-ink dark:border-white/15 dark:bg-card dark:text-fg"
                      }`}
                    >
                      {t(`transactions.types.${tp}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Compte et catégorie forment un groupe : espacement serré à l'intérieur, large autour. */}
            <div className="flex flex-col gap-3">
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
                  {[...categories].sort(byName).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t("transactions.minAmount")}>
                <AmountTextInput
                  className={inputClass}
                  defaultValue=""
                  onBlur={(e) => {
                    const value =
                      e.target.value.trim() === ""
                        ? undefined
                        : (parseAmountText(e.target.value, baseCurrency) ?? undefined);
                    setDraftFilters((f) => ({ ...f, minAmount: value }));
                  }}
                />
              </Field>
              <Field label={t("transactions.maxAmount")}>
                <AmountTextInput
                  className={inputClass}
                  defaultValue=""
                  onBlur={(e) => {
                    const value =
                      e.target.value.trim() === ""
                        ? undefined
                        : (parseAmountText(e.target.value, baseCurrency) ?? undefined);
                    setDraftFilters((f) => ({ ...f, maxAmount: value }));
                  }}
                />
              </Field>
            </div>
          </div>
        </BottomSheet>
      ) : null}

      {sheetMode === "view" && target ? (
        <TransactionDetailSheet
          transaction={target}
          category={
            target.categoryId ? categories.find((c) => c.id === target.categoryId) : undefined
          }
          walletName={(wid) => walletName.get(wid ?? "") ?? ""}
          onClose={closeSheet}
          onEdit={() => navigate(`/transactions/${target.id}/edit`)}
          onDelete={() => void deleteIds([target.id]).then(closeSheet)}
        />
      ) : null}
      {(sheetMode === "new" && (!copyFromId || copySource)) || (sheetMode === "edit" && editing) ? (
        <TransactionSheet
          key={sheetMode === "edit" ? `edit-${id}` : `new-${defaultType ?? ""}-${copyFromId ?? ""}`}
          transaction={editing}
          defaultType={defaultType ?? undefined}
          copyOf={copySource ?? undefined}
          onDuplicate={(tx) => navigate(`/transactions/new?from=${tx.id}`)}
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
  categoryIcon?: string | undefined;
  categoryColor?: string | undefined;
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
  categoryIcon,
  categoryColor,
  selectMode,
  selected,
  onToggle,
  onOpen,
  time,
}: TransactionRowProps) {
  const { t: translate } = useTranslation();
  // Titre comme au calendrier : le mémo d’abord, puis la catégorie ; le détail suit.
  const label =
    t.type === "transfer"
      ? `${walletName} → ${toWalletName}`
      : t.memo || categoryName || translate(`transactions.types.${t.type}`);
  const sign = t.type === "income" || (t.type === "adjustment" && t.amount > 0) ? "+" : "";

  const amountClass =
    t.type === "expense"
      ? "text-expense dark:text-expense-dark"
      : t.type === "income"
        ? "text-income dark:text-income-dark"
        : "text-ink dark:text-fg";
  const details =
    t.type === "transfer"
      ? translate("transactions.types.transfer")
      : // Sans mémo, la catégorie est déjà le titre : on ne la répète pas.
        [t.memo ? categoryName : "", walletName].filter(Boolean).join(" · ");

  // Nom lisible : titre, détail, type et montant en toutes lettres (sans emoji ni signes décoratifs).
  const kind = translate(`transactions.types.${t.type}`);
  const rowName = [label, details, kind, `${formatMoney(Math.abs(t.amount), t.currency)}`, time]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={selectMode ? onToggle : onOpen}
      aria-label={rowName}
      className="flex min-h-[56px] w-full items-center gap-3 border-b border-neutral-200 px-3 py-2.5 text-left transition-colors duration-150 active:bg-neutral-100 dark:border-white/15 dark:active:bg-neutral-800/60"
      aria-pressed={selectMode ? selected : undefined}
    >
      {selectMode ? (
        // Même colonne que la case du jour : les cases et les pastilles s'alignent verticalement.
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors duration-150 ${
              selected ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-600"
            }`}
          >
            {selected ? "✓" : null}
          </span>
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-white"
        style={{ backgroundColor: categoryColor ?? "#64748b" }}
      >
        {categoryIcon ?? "•"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-ink dark:text-fg">{label}</span>
        <span className="truncate text-sm text-neutral-600 dark:text-muted">{details}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span
          className={`whitespace-nowrap text-[15px] font-semibold tabular-nums ${amountClass}`}
          data-amount
        >
          {t.type === "expense" ? "−" : sign}
          {formatMoney(t.amount, t.currency)}
        </span>
        <span className="text-xs text-neutral-600 dark:text-muted">{time}</span>
      </span>
    </button>
  );
}

/** Case de sélection d'une date : même trait que les lignes, zone tactile de 44 px, état « partiel ». */
function DaySelectCheckbox({
  label,
  checked,
  mixed,
  onToggle,
}: {
  label: string;
  checked: boolean;
  mixed: boolean;
  onToggle: () => void;
}) {
  const on = checked || mixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onClick={onToggle}
      className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors duration-150 ${
          on ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-600"
        }`}
      >
        {checked ? "✓" : mixed ? "–" : null}
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
