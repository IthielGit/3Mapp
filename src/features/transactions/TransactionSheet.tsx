import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import type { Subcategory, Transaction } from "../../db/entities";
import { RuleError } from "../../db/errors";
import { BottomSheet } from "../../components/BottomSheet";
import { AmountInput } from "../../components/AmountInput";
import {
  Field,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "../../components/FormControls";
import { expressionToMinor } from "../../lib/calc";
import { minorToPlainText } from "../../lib/amount-text";
import type { CurrencyCode } from "../../lib/money";
import { addAttachment, removeAttachment } from "./attachment-service";
import { saveTransactionAsTemplate } from "./template-service";
import { createRecurring } from "../recurring/recurring-service";
import { occurrenceDate, type Frequency } from "../../domain/recurrence";
import {
  createTransaction,
  draftFromTransaction,
  duplicateTransaction,
  updateTransaction,
  type TransactionDraft,
} from "./transaction-service";

type TxType = Transaction["type"];
const TYPES: TxType[] = ["expense", "income", "transfer", "adjustment"];

/** Couleur de l'onglet actif : sémantique (dépense rouge, revenu bleu, virement teal). */
const TYPE_ACTIVE: Record<TxType, string> = {
  expense: "bg-expense text-white shadow",
  income: "bg-income text-white shadow",
  transfer: "bg-brand-700 text-white shadow",
  adjustment: "bg-slate-700 text-white shadow dark:bg-slate-500",
};

interface TransactionSheetProps {
  transaction?: Transaction | undefined;
  defaultType?: TxType | undefined;
  onClose: () => void;
  onDelete?: ((transaction: Transaction) => void) | undefined;
}

export function TransactionSheet({
  transaction,
  defaultType,
  onClose,
  onDelete,
}: TransactionSheetProps) {
  const { t } = useTranslation();
  const initial = transaction ? draftFromTransaction(transaction) : undefined;

  const wallets = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const settings = useLiveQuery(() => db.settings.toArray(), []) ?? [];
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const activeWallets = wallets.filter((w) => !w.archived || w.id === initial?.walletId);

  const [type, setType] = useState<TxType>(initial?.type ?? defaultType ?? "expense");
  // Récurrence à la création : la première échéance est la période suivante (pas de doublon).
  const [repeat, setRepeat] = useState(false);
  const [repeatUnit, setRepeatUnit] = useState<Frequency["unit"]>("month");
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [amountExpr, setAmountExpr] = useState(
    transaction ? minorToPlainText(Math.abs(transaction.amount), transaction.currency) : "",
  );
  const [adjustSign, setAdjustSign] = useState<"+" | "-">(
    transaction && transaction.amount < 0 ? "-" : "+",
  );
  const [walletId, setWalletId] = useState(initial?.walletId ?? "");
  const [toWalletId, setToWalletId] = useState(initial?.toWalletId ?? "");
  const [toAmountExpr, setToAmountExpr] = useState(
    transaction?.toAmount !== undefined && transaction.toWalletId
      ? minorToPlainText(transaction.toAmount, transactionTargetCurrency(transaction, wallets))
      : "",
  );
  const [feeExpr, setFeeExpr] = useState(
    transaction?.fee ? minorToPlainText(transaction.fee, transaction.currency) : "",
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? "");
  const [dateLocal, setDateLocal] = useState(
    format(initial ? new Date(initial.date) : new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [attachmentIds, setAttachmentIds] = useState<string[]>(initial?.attachmentIds ?? []);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const effectiveWalletId = walletId || settings[0]?.defaultWalletId || activeWallets[0]?.id || "";
  const sourceWallet = wallets.find((w) => w.id === effectiveWalletId);
  const currency: CurrencyCode = sourceWallet?.currency ?? "MGA";
  const targetWallet = wallets.find((w) => w.id === toWalletId);
  const crossCurrency =
    type === "transfer" && targetWallet !== undefined && targetWallet.currency !== currency;
  const kind = type === "income" ? "income" : "expense";
  const categoryOptions = categories.filter((c) => !c.archived && c.kind === kind);

  const subcategories =
    useLiveQuery(
      () =>
        categoryId
          ? db.subcategories.where("categoryId").equals(categoryId).toArray()
          : Promise.resolve<Subcategory[]>([]),
      [categoryId],
    ) ?? [];

  /** Pré-remplit le formulaire depuis un modèle (SPEC §5.6). La date reste « maintenant ». */
  function applyTemplate(templateId: string) {
    const tp = templates.find((x) => x.id === templateId);
    if (!tp) return;
    const tpCurrency = wallets.find((w) => w.id === tp.walletId)?.currency ?? tp.currency;
    setType(tp.type);
    setAmountExpr(minorToPlainText(tp.amount, tpCurrency));
    setWalletId(tp.walletId);
    setToWalletId(tp.toWalletId ?? "");
    setCategoryId(tp.categoryId ?? "");
    setSubcategoryId(tp.subcategoryId ?? "");
    setMemo(tp.memo);
    setFeeExpr(tp.fee ? minorToPlainText(tp.fee, tpCurrency) : "");
  }

  async function saveAsTemplate() {
    if (!transaction) return;
    const name = window.prompt(t("templates.templateName"), transaction.memo || "");
    if (!name || name.trim() === "") return;
    try {
      await saveTransactionAsTemplate(transaction.id, name, "📄");
      setError(undefined);
      window.alert(t("templates.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  /** Construit le brouillon ; toute saisie invalide lève une RuleError lisible. */
  function buildDraft(): TransactionDraft {
    if (!sourceWallet) throw new RuleError(t("transactions.chooseWallet"));
    const amount = expressionToMinor(amountExpr, currency);
    if (amount === null) throw new RuleError(t("errors.invalidAmount"));
    const signedAmount = type === "adjustment" && adjustSign === "-" ? -amount : amount;

    let toAmount: number | undefined;
    if (crossCurrency && targetWallet) {
      const received = expressionToMinor(toAmountExpr, targetWallet.currency);
      if (received === null) throw new RuleError(t("transactions.receivedAmountRequired"));
      toAmount = received;
    }

    let fee: number | undefined;
    if (type === "transfer" && feeExpr.trim() !== "") {
      const parsedFee = expressionToMinor(feeExpr, currency);
      if (parsedFee === null) throw new RuleError(t("errors.invalidAmount"));
      fee = parsedFee;
    }

    const isCategorised = type === "expense" || type === "income";
    return {
      type,
      amount: signedAmount,
      walletId: sourceWallet.id,
      toWalletId: type === "transfer" ? toWalletId || undefined : undefined,
      toAmount,
      fee,
      categoryId: isCategorised ? categoryId || undefined : undefined,
      subcategoryId: isCategorised ? subcategoryId || undefined : undefined,
      memo,
      attachmentIds,
      date: new Date(dateLocal).toISOString(),
      status: "posted",
    };
  }

  async function save() {
    setError(undefined);
    setSaving(true);
    try {
      const draft = buildDraft();
      if (transaction) {
        await updateTransaction(transaction.id, draft);
      } else {
        await createTransaction(draft);
        if (repeat && draft.type !== "adjustment") {
          const frequency: Frequency = { unit: repeatUnit, interval: repeatEvery };
          const next = occurrenceDate(new Date(draft.date), frequency, 1, "same_day");
          await createRecurring({
            draft,
            frequency,
            startDate: next.toISOString(),
            dayOfMonthRule: "same_day",
            autoPost: true,
          });
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!transaction) return;
    setError(undefined);
    try {
      await duplicateTransaction(transaction.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setError(undefined);
    for (const file of Array.from(files)) {
      try {
        const id = await addAttachment(file);
        setAttachmentIds((ids) => [...ids, id]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.generic"));
      }
    }
  }

  async function detach(id: string) {
    setAttachmentIds((ids) => ids.filter((x) => x !== id));
    await removeAttachment(id);
  }

  return (
    <BottomSheet
      open
      title={transaction ? t("transactions.editTitle") : t("transactions.newTitle")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label={t("transactions.type")}
          className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
        >
          {TYPES.map((tp) => (
            <button
              key={tp}
              type="button"
              role="radio"
              aria-checked={type === tp}
              onClick={() => setType(tp)}
              className={`min-h-[44px] rounded-md text-sm font-semibold transition-colors ${
                type === tp ? TYPE_ACTIVE[tp] : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {t(`transactions.types.${tp}`)}
            </button>
          ))}
        </div>

        {!transaction && templates.length > 0 ? (
          <Field label={t("templates.label")}>
            <select className={inputClass} value="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">{t("templates.none")}</option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.icon} {tp.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <AmountInput
          expression={amountExpr}
          onExpressionChange={setAmountExpr}
          currency={currency}
          label={t("transactions.amount")}
        />

        {!transaction && type !== "adjustment" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <label className="flex min-h-[44px] items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand-700"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              <span className="font-medium">{t("repeat.label")}</span>
            </label>
            {repeat ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("repeat.every")}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      inputMode="numeric"
                      className={inputClass}
                      value={repeatEvery}
                      onChange={(e) =>
                        setRepeatEvery(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                      }
                    />
                  </Field>
                  <Field label={t("repeat.unit")}>
                    <select
                      className={inputClass}
                      value={repeatUnit}
                      onChange={(e) => setRepeatUnit(e.target.value as Frequency["unit"])}
                    >
                      <option value="day">{t("repeat.day")}</option>
                      <option value="week">{t("repeat.week")}</option>
                      <option value="month">{t("repeat.month")}</option>
                      <option value="year">{t("repeat.year")}</option>
                    </select>
                  </Field>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("repeat.hint")}</p>
              </>
            ) : null}
          </div>
        ) : null}

        {type === "adjustment" ? (
          <div
            role="radiogroup"
            aria-label={t("transactions.adjustSign")}
            className="grid grid-cols-2 gap-2"
          >
            {(["+", "-"] as const).map((sign) => (
              <button
                key={sign}
                type="button"
                role="radio"
                aria-checked={adjustSign === sign}
                onClick={() => setAdjustSign(sign)}
                className={`min-h-[44px] rounded-lg border ${adjustSign === sign ? "border-brand-700 bg-brand-50 dark:bg-slate-800" : "border-slate-300 dark:border-slate-700"}`}
              >
                {sign === "+" ? t("transactions.increase") : t("transactions.decrease")}
              </button>
            ))}
          </div>
        ) : null}

        <Field
          label={type === "transfer" ? t("transactions.fromWallet") : t("transactions.wallet")}
        >
          <select
            className={inputClass}
            value={effectiveWalletId}
            onChange={(e) => setWalletId(e.target.value)}
          >
            {activeWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.currency})
              </option>
            ))}
          </select>
        </Field>

        {type === "transfer" ? (
          <>
            <Field label={t("transactions.toWallet")}>
              <select
                className={inputClass}
                value={toWalletId}
                onChange={(e) => setToWalletId(e.target.value)}
              >
                <option value="">—</option>
                {activeWallets
                  .filter((w) => w.id !== effectiveWalletId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
              </select>
            </Field>
            {crossCurrency && targetWallet ? (
              <Field label={t("transactions.receivedAmount", { currency: targetWallet.currency })}>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={toAmountExpr}
                  onChange={(e) => setToAmountExpr(e.target.value)}
                />
              </Field>
            ) : null}
            <Field label={t("transactions.fee", { currency })}>
              <input
                inputMode="decimal"
                className={inputClass}
                value={feeExpr}
                onChange={(e) => setFeeExpr(e.target.value)}
              />
            </Field>
          </>
        ) : null}

        {type === "expense" || type === "income" ? (
          <>
            <Field label={t("common.category")}>
              <select
                className={inputClass}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
              >
                <option value="">—</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {subcategories.length > 0 ? (
              <Field label={t("transactions.subcategory")}>
                <select
                  className={inputClass}
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                >
                  <option value="">—</option>
                  {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        ) : null}

        <Field label={t("transactions.date")}>
          <input
            type="datetime-local"
            className={inputClass}
            value={dateLocal}
            onChange={(e) => setDateLocal(e.target.value)}
          />
        </Field>

        <Field label={t("transactions.memo")}>
          <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-2">
          <label
            className={buttonSecondary + " inline-flex cursor-pointer items-center justify-center"}
          >
            {t("transactions.addAttachment")}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
          {attachmentIds.length > 0 ? (
            <p className="text-sm text-slate-500">
              {t("transactions.attachmentCount", { count: attachmentIds.length })}
            </p>
          ) : null}
          {attachmentIds.map((id) => (
            <button
              key={id}
              type="button"
              className="self-start text-sm text-red-700 underline"
              onClick={() => void detach(id)}
            >
              {t("transactions.removeAttachment")}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className={buttonPrimary}
          onClick={() => void save()}
          disabled={saving}
        >
          {t("common.save")}
        </button>

        {transaction ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={buttonSecondary} onClick={() => void saveAsTemplate()}>
              {t("templates.saveAsTemplate")}
            </button>
            <button type="button" className={buttonSecondary} onClick={() => void duplicate()}>
              {t("transactions.duplicate")}
            </button>
            <button type="button" className={buttonDanger} onClick={() => onDelete?.(transaction)}>
              {t("common.delete")}
            </button>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}

/** Devise de la destination d'un virement existant (pour afficher le montant reçu). */
function transactionTargetCurrency(
  transaction: Transaction,
  wallets: readonly { id: string; currency: CurrencyCode }[],
): CurrencyCode {
  return wallets.find((w) => w.id === transaction.toWalletId)?.currency ?? transaction.currency;
}
