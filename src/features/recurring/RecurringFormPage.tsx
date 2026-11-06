import { PageTitle } from "../../components/PageHeader";
import { useId, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { byName } from "../../lib/compare";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { QuickCategorySheet } from "../categories/QuickCategorySheet";
import { CategoryPicker } from "../transactions/CategoryPicker";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { parseAmountText } from "../../lib/amount-entry";
import { AmountTextInput } from "../../components/AmountTextInput";
import type { Recurring } from "../../db/entities";
import type { DayRule, RecurrenceUnit } from "../../domain/recurrence";
import { createRecurring, updateRecurring } from "./recurring-service";

const EMPTY: never[] = [];
type TxType = Recurring["type"];

export function RecurringFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const endId = useId();
  const startId = useId();
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const active = wallets.filter((w) => !w.archived);

  const [type, setType] = useState<TxType>("expense");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [memo, setMemo] = useState("");
  const [unit, setUnit] = useState<RecurrenceUnit>("month");
  const [interval, setInterval] = useState("1");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [lastDay, setLastDay] = useState(false);
  const [autoPost, setAutoPost] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Modification : pré-remplit le formulaire avec la récurrence existante (une seule fois).
  const { id: editId } = useParams();
  const existing = useLiveQuery(() => (editId ? db.recurring.get(editId) : undefined), [editId]);
  const [prefilled, setPrefilled] = useState(!editId);
  // Mise à jour d'état pendant le rendu (et non dans un effet) : le formulaire est rempli dès que
  // la récurrence est chargée, une seule fois.
  if (!prefilled && existing) {
    setType(existing.type);
    setWalletId(existing.walletId);
    setToWalletId(existing.toWalletId ?? "");
    setAmountText(formatMoney(existing.amount, existing.currency, { withSymbol: false }));
    setCategoryId(existing.categoryId ?? "");
    setMemo(existing.memo);
    setUnit(existing.frequency.unit);
    setInterval(String(existing.frequency.interval));
    setStartDate(format(new Date(existing.startDate), "yyyy-MM-dd"));
    setEndDate(existing.endDate ? format(new Date(existing.endDate), "yyyy-MM-dd") : "");
    setLastDay(existing.dayOfMonthRule === "last_day");
    setAutoPost(existing.autoPost);
    setPrefilled(true);
  }

  const effectiveWallet = walletId || active[0]?.id || "";
  const currency: CurrencyCode = active.find((w) => w.id === effectiveWallet)?.currency ?? "MGA";
  const kind = type === "income" ? "income" : "expense";
  const isCategorised = type === "expense" || type === "income";
  const isMonthly = unit === "month" || unit === "year";

  /** Premier problème bloquant, ou null quand le formulaire peut être enregistré. */
  function validationError(amount: number | null, every: number): string | null {
    if (amount === null || amount <= 0) return t("transactions.amountRequired");
    if (!Number.isInteger(every) || every < 1) return t("recurring.invalidInterval");
    if (isCategorised && !categoryId) return t("transactions.categoryRequired");
    if (type === "transfer" && !toWalletId) return t("transactions.chooseWallet");
    if (!editId && !startDate) return t("errors.required");
    return null;
  }

  async function save() {
    const amount = parseAmountText(amountText, currency);
    const every = Number(interval);
    const problem = validationError(amount, every);
    if (problem !== null || amount === null) {
      setError(problem ?? t("transactions.amountRequired"));
      return;
    }
    setError(undefined);
    try {
      const input = {
        draft: {
          type,
          amount,
          walletId: effectiveWallet,
          toWalletId: type === "transfer" ? toWalletId || undefined : undefined,
          categoryId: isCategorised ? categoryId || undefined : undefined,
          memo,
          attachmentIds: [],
        },
        frequency: { unit, interval: every },
        endDate: endDate ? new Date(`${endDate}T23:59`).toISOString() : undefined,
        // La règle « dernier jour » ne vaut que pour les récurrences mensuelles ou annuelles.
        dayOfMonthRule: (isMonthly && lastDay ? "last_day" : "same_day") as DayRule,
        autoPost,
      };
      if (editId) {
        await updateRecurring(editId, input);
      } else {
        await createRecurring({
          ...input,
          startDate: new Date(`${startDate}T00:00`).toISOString(),
        });
      }
      navigate("/plus/recurring", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <PageTitle className="text-xl font-semibold">
        {editId ? t("recurring.editTitle") : t("recurring.newTitle")}
      </PageTitle>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2">
        <Field label={t("transactions.type")}>
          <select
            className={inputClass}
            value={type}
            onChange={(e) => setType(e.target.value as TxType)}
          >
            {(["expense", "income", "transfer"] as const).map((tp) => (
              <option key={tp} value={tp}>
                {t(`transactions.types.${tp}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t("transactions.amount")} (${currency})`}>
          <AmountTextInput
            className={inputClass}
            value={amountText}
            onValueChange={setAmountText}
          />
        </Field>
      </div>

      <Field label={t("transactions.wallet")}>
        <select
          className={inputClass}
          value={effectiveWallet}
          onChange={(e) => setWalletId(e.target.value)}
        >
          {active.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.currency})
            </option>
          ))}
        </select>
      </Field>

      {type === "transfer" ? (
        <Field label={t("transactions.toWallet")}>
          <select
            className={inputClass}
            value={toWalletId}
            onChange={(e) => setToWalletId(e.target.value)}
          >
            <option value="">—</option>
            {active
              .filter((w) => w.id !== effectiveWallet)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </Field>
      ) : (
        <>
          <CategoryPicker
            label={t("common.category")}
            placeholder={t("transactions.chooseCategory")}
            value={categoryId}
            options={categories.filter((c) => c.kind === kind && !c.archived).sort(byName)}
            onChange={(id) => setCategoryId(id)}
            onCreateNew={() => setCreatingCategory(true)}
          />
          <QuickCategorySheet
            open={creatingCategory}
            kind={kind}
            onClose={() => setCreatingCategory(false)}
            onCreated={(id) => {
              setCategoryId(id);
              setCreatingCategory(false);
            }}
          />
        </>
      )}

      <Field label={t("transactions.memo")}>
        <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2">
        <Field label={t("recurring.every_label")}>
          <input
            inputMode="numeric"
            className={inputClass}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          />
        </Field>
        <Field label={t("recurring.unit")}>
          <select
            className={inputClass}
            value={unit}
            onChange={(e) => setUnit(e.target.value as RecurrenceUnit)}
          >
            {(["day", "week", "month", "year"] as const).map((u) => (
              <option key={u} value={u}>
                {t(`recurring.units.${u}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("recurring.startDate")}>
          <input
            id={startId}
            type="date"
            className={inputClass}
            value={startDate}
            disabled={Boolean(editId)}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1">
            <label htmlFor={endId} className="truncate text-sm font-medium">
              {t("recurring.endDate")}
            </label>
            {endDate ? (
              <button
                type="button"
                className="-my-2 min-h-[44px] shrink-0 px-1 text-sm font-medium text-brand-700 dark:text-brand-dark"
                onClick={() => setEndDate("")}
              >
                {t("recurring.clearEnd")}
              </button>
            ) : null}
          </div>
          <input
            id={endId}
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col divide-y divide-neutral-300 overflow-hidden rounded-xl border border-neutral-500 dark:divide-white/15 dark:border-white/15">
        {isMonthly ? (
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 px-3 py-2.5 text-sm leading-snug">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0"
              checked={lastDay}
              onChange={(e) => setLastDay(e.target.checked)}
            />
            <span>{t("recurring.lastDay")}</span>
          </label>
        ) : null}
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 px-3 py-2.5 text-sm leading-snug">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={autoPost}
            onChange={(e) => setAutoPost(e.target.checked)}
          />
          <span>{t("recurring.autoPost")}</span>
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={buttonSecondary} onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </button>
        <button type="button" className={buttonPrimary} onClick={() => void save()}>
          {t("common.save")}
        </button>
      </div>
    </section>
  );
}
