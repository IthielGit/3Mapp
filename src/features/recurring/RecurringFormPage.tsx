import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { byName } from "../../lib/compare";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { createCategory } from "../categories/category-service";
import { parseMoney, type CurrencyCode } from "../../lib/money";
import type { Recurring } from "../../db/entities";
import type { DayRule, RecurrenceUnit } from "../../domain/recurrence";
import { createRecurring, updateRecurring } from "./recurring-service";
import { minorToPlainText } from "../../lib/amount-text";

const EMPTY: never[] = [];
type TxType = Recurring["type"];

export function RecurringFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const active = wallets.filter((w) => !w.archived);

  const [type, setType] = useState<TxType>("expense");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [memo, setMemo] = useState("");
  const [unit, setUnit] = useState<RecurrenceUnit>("month");
  const [interval, setInterval] = useState("1");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
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
    setAmountText(minorToPlainText(existing.amount, existing.currency));
    setCategoryId(existing.categoryId ?? "");
    setMemo(existing.memo);
    setUnit(existing.frequency.unit);
    setInterval(String(existing.frequency.interval));
    setStartDate(format(new Date(existing.startDate), "yyyy-MM-ddTHH:mm"));
    setEndDate(existing.endDate ? format(new Date(existing.endDate), "yyyy-MM-dd") : "");
    setLastDay(existing.dayOfMonthRule === "last_day");
    setAutoPost(existing.autoPost);
    setPrefilled(true);
  }

  const effectiveWallet = walletId || active[0]?.id || "";
  const currency: CurrencyCode = active.find((w) => w.id === effectiveWallet)?.currency ?? "MGA";
  const kind = type === "income" ? "income" : "expense";

  /** Crée une catégorie du même genre que la récurrence et la sélectionne. */
  async function createQuickCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const created = await createCategory({ name, kind, icon: "🏷️", color: "#64748b", archived: false });
      setCategoryId(created.id);
      setNewCategoryName("");
      setCreatingCategory(false);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  /** Ce qui manque avant d'enregistrer ; null quand le formulaire est complet. */
  function missingField(): string | null {
    const amount = parseMoney(amountText, currency);
    if (amount === null || amount <= 0) return t("transactions.amountRequired");
    const every = Number(interval);
    if (!Number.isInteger(every) || every < 1) return t("recurring.invalidInterval");
    if ((type === "expense" || type === "income") && !categoryId) return t("transactions.categoryRequired");
    if (type === "transfer" && !toWalletId) return t("transactions.chooseWallet");
    return null;
  }

  async function save() {
    setError(undefined);
    const amount = parseMoney(amountText, currency);
    if (amount === null || amount <= 0) return setError(t("errors.invalidAmount"));
    const every = Number(interval);
    if (!Number.isInteger(every) || every < 1) return setError(t("recurring.invalidInterval"));
    const isCategorised = type === "expense" || type === "income";
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
        dayOfMonthRule: (lastDay ? "last_day" : "same_day") as DayRule,
        autoPost,
      };
      if (editId) {
        await updateRecurring(editId, input);
      } else {
        await createRecurring({ ...input, startDate: new Date(startDate).toISOString() });
      }
      navigate("/plus/recurring", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <PageTitle className="text-2xl font-semibold">
        {editId ? t("recurring.editTitle") : t("recurring.newTitle")}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3">
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
          <input
            inputMode="decimal"
            className={inputClass}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <div className="flex flex-col gap-2">
            <Field label={t("common.category")}>
              <select
                className={inputClass}
                value={categoryId}
                required
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="" disabled>
                  {t("transactions.chooseCategory")}
                </option>
                {categories
                  .filter((c) => c.kind === kind && !c.archived)
                  .sort(byName)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            {creatingCategory ? (
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={newCategoryName}
                  aria-label={t("common.name")}
                  placeholder={t("common.name")}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={!newCategoryName.trim()}
                  onClick={() => void createQuickCategory()}
                >
                  {t("common.add")}
                </button>
                <button type="button" className={buttonSecondary} onClick={() => setCreatingCategory(false)}>
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="min-h-[44px] self-start font-medium text-brand-700 dark:text-brand-300"
                onClick={() => setCreatingCategory(true)}
              >
                + {t("transactions.newCategory")}
              </button>
            )}
          </div>
        )}
      </div>

      <Field label={t("transactions.memo")}>
        <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
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

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("recurring.startDate")}>
          <input
            type="datetime-local"
            className={inputClass}
            value={startDate}
            disabled={Boolean(editId)}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label={t("recurring.endDate")}>
          <input
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {unit === "month" || unit === "year" ? (
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0"
              checked={lastDay}
              onChange={(e) => setLastDay(e.target.checked)}
            />
            {t("recurring.lastDay")}
          </label>
        ) : null}

        <label className="flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0"
            checked={autoPost}
            onChange={(e) => setAutoPost(e.target.checked)}
          />
          {t("recurring.autoPost")}
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button type="button" className={buttonSecondary} onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className={buttonPrimary}
          onClick={() => void save()}
          disabled={missingField() !== null}
        >
          {t("common.save")}
        </button>
      </div>
    </section>
  );
}
