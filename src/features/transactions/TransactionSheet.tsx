import { Icon, type IconName } from "../../components/Icon";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { byName } from "../../lib/compare";
import type { Subcategory, Transaction } from "../../db/entities";
import { RuleError } from "../../db/errors";
import { BottomSheet } from "../../components/BottomSheet";
import { ActionMenu } from "../../components/DetailHeader";
import { AmountInput } from "../../components/AmountInput";
import {
  Field,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "../../components/FormControls";
import { expressionToMinor } from "../../lib/calc";
import { QuickCategorySheet } from "../categories/QuickCategorySheet";
import { minorToPlainText } from "../../lib/amount-text";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { createRecurring } from "../recurring/recurring-service";
import { occurrenceDate, type Frequency } from "../../domain/recurrence";
import {
  createTransaction,
  draftFromTransaction,
  updateTransaction,
  type TransactionDraft,
} from "./transaction-service";

type TxType = Transaction["type"];
const TYPES: TxType[] = ["expense", "income", "transfer", "adjustment"];

/**
 * Types proposés : l'ajustement n'est pas proposé pour une nouvelle transaction (il vient de la
 * réconciliation). Il reste affiché quand on modifie un ajustement existant.
 */
function typeOptionsFor(editing: TxType | undefined): TxType[] {
  return editing === "adjustment" ? TYPES : TYPES.filter((tp) => tp !== "adjustment");
}

const TYPE_ICON: Record<TxType, IconName> = {
  expense: "minus",
  income: "plus",
  transfer: "swap",
  adjustment: "tune",
};

/** Couleur de l'onglet actif : sémantique (dépense rouge, revenu bleu, virement teal). */
const TYPE_ACTIVE: Record<TxType, string> = {
  expense: "bg-expense text-white shadow",
  income: "bg-income text-white shadow",
  transfer: "bg-brand-700 text-white shadow dark:bg-white dark:text-ink",
  adjustment: "bg-slate-700 text-white shadow dark:bg-slate-500",
};

interface TransactionSheetProps {
  transaction?: Transaction | undefined;
  defaultType?: TxType | undefined;
  onClose: () => void;
  onDelete?: ((transaction: Transaction) => void) | undefined;
  /** Ouvre le formulaire de création pré-rempli avec cette transaction (rien n'est enregistré avant). */
  onDuplicate?: ((transaction: Transaction) => void) | undefined;
  /** Source de copie : pré-remplit un nouveau formulaire, sans la modifier. */
  copyOf?: Transaction | undefined;
}

const NEW_CATEGORY = "__new__";
export function TransactionSheet({
  transaction,
  defaultType,
  onClose,
  onDelete,
  onDuplicate,
  copyOf,
}: TransactionSheetProps) {
  const { t } = useTranslation();
  const source = transaction ?? copyOf;
  const initial = source ? draftFromTransaction(source) : undefined;

  const wallets = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const settings = useLiveQuery(() => db.settings.toArray(), []) ?? [];
  const activeWallets = wallets.filter((w) => !w.archived || w.id === initial?.walletId);

  // Le pavé est replié à l'ouverture (création comme modification) : le montant se saisit au toucher.
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [type, setType] = useState<TxType>(initial?.type ?? defaultType ?? "expense");
  const typeOptions = typeOptionsFor(transaction?.type);
  // Récurrence à la création : la première échéance est la période suivante (pas de doublon).
  const [repeat, setRepeat] = useState(false);
  const [repeatUnit, setRepeatUnit] = useState<Frequency["unit"]>("month");
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [amountExpr, setAmountExpr] = useState(
    source ? minorToPlainText(Math.abs(source.amount), source.currency) : "",
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
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? "");
  const [dateLocal, setDateLocal] = useState(
    // Une copie prend la date du jour : c'est une nouvelle transaction.
    format(transaction && initial ? new Date(initial.date) : new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  // Plus de saisie de photos : les pièces jointes déjà présentes sont conservées telles quelles.
  // Les pièces jointes ne sont pas copiées.
  const attachmentIds = transaction ? (initial?.attachmentIds ?? []) : [];
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const effectiveWalletId = walletId || settings[0]?.defaultWalletId || activeWallets[0]?.id || "";
  const sourceWallet = wallets.find((w) => w.id === effectiveWalletId);
  const currency: CurrencyCode = sourceWallet?.currency ?? "MGA";
  const amountMinor = amountExpr.trim() === "" ? null : expressionToMinor(amountExpr, currency);
  const amountDisplay = amountMinor !== null ? formatMoney(amountMinor, currency) : amountExpr.trim() || "0";
  const targetWallet = wallets.find((w) => w.id === toWalletId);
  const crossCurrency =
    type === "transfer" && targetWallet !== undefined && targetWallet.currency !== currency;
  const kind = type === "income" ? "income" : "expense";
  const categoryOptions = categories.filter((c) => !c.archived && c.kind === kind).sort(byName);

  const subcategories =
    useLiveQuery(
      () =>
        categoryId
          ? db.subcategories.where("categoryId").equals(categoryId).toArray()
          : Promise.resolve<Subcategory[]>([]),
      [categoryId],
    ) ?? [];



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
    if (isCategorised && !categoryId) throw new RuleError(t("transactions.categoryRequired"));
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
      note: note.trim() || undefined,
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

  function duplicate() {
    if (!transaction) return;
    onDuplicate?.(transaction);
  }

  /** Ce qui manque avant d'enregistrer ; null quand le formulaire est complet. */
  function missingField(): string | null {
    const value = amountExpr.trim() === "" ? null : expressionToMinor(amountExpr, currency);
    if (value === null || value <= 0) return t("transactions.amountRequired");
    try {
      buildDraft();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : t("errors.generic");
    }
  }
  const missing = missingField();

  return (
    <BottomSheet
      open
      title={transaction ? t("transactions.editTitle") : t("transactions.newTitle")}
      onClose={onClose}
      actions={
        transaction ? (
            <ActionMenu
              items={[
                { label: t("transactions.duplicate"), onSelect: () => void duplicate() },
                { label: t("common.delete"), onSelect: () => onDelete?.(transaction), danger: true },
              ]}
            />
        ) : undefined
      }
      footer={
        <div className="flex flex-col gap-2">
          {missing ? (
            <p className="text-center text-sm text-slate-600 dark:text-muted">{missing}</p>
          ) : null}
          <button
            type="button"
            className={`${buttonPrimary} w-full`}
            onClick={() => void save()}
            disabled={saving || missing !== null}
          >
            {t("common.save")}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          role="radiogroup"
          aria-label={t("transactions.type")}
          className={`grid ${typeOptions.length === 4 ? "grid-cols-4" : "grid-cols-3"} gap-1 rounded-lg bg-slate-100 p-1 dark:bg-raised`}
        >
          {typeOptions.map((tp) => (
            <button
              key={tp}
              type="button"
              role="radio"
              aria-checked={type === tp}
              onClick={() => setType(tp)}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors ${
                type === tp ? TYPE_ACTIVE[tp] : "text-slate-600 dark:text-muted"
              }`}
            >
              <Icon name={TYPE_ICON[tp]} className="h-4 w-4" />
              {t(`transactions.types.${tp}`)}
            </button>
          ))}
        </div>
        {type === "transfer" ? (
          <p className="text-sm text-slate-600 dark:text-muted">{t("transactions.transferHint")}</p>
        ) : null}


        {keypadOpen ? (
          <div className="flex flex-col gap-2">
            <AmountInput
              expression={amountExpr}
              onExpressionChange={setAmountExpr}
              currency={currency}
              label={t("transactions.amount")}
            />
            <button
              type="button"
              className={`${buttonSecondary} w-full`}
              onClick={() => setKeypadOpen(false)}
            >
              {t("transactions.amountDone")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setKeypadOpen(true)}
            className="flex min-h-[64px] w-full flex-col items-start gap-0.5 rounded-lg border border-slate-300 px-3 py-2 text-left dark:border-white/15"
          >
            <span className="text-sm text-slate-600 dark:text-muted">{t("transactions.amount")}</span>
            <span className="text-3xl font-semibold tabular-nums" data-amount>
              {amountDisplay}
            </span>
            <span className="text-sm text-brand-700 dark:text-brand-300">
              {source ? t("transactions.amountTapToEdit") : t("transactions.amountTapToEnter")}
            </span>
          </button>
        )}

        {!transaction && type !== "adjustment" ? (
          <div className="flex flex-col gap-2">
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
                <p className="text-sm text-slate-600 dark:text-muted">{t("repeat.hint")}</p>
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
                className={`min-h-[44px] rounded-lg border ${adjustSign === sign ? "border-brand-700 bg-brand-50 dark:bg-raised" : "border-slate-300 dark:border-white/15"}`}
              >
                {sign === "+" ? t("transactions.increase") : t("transactions.decrease")}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
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
          ) : (
              <>
            <Field label={t("common.category")}>
              <select
                className={inputClass}
                value={categoryId}
                required
                onChange={(e) => {
                  if (e.target.value === NEW_CATEGORY) {
                    setCreatingCategory(true);
                    return;
                  }
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
              >
                <option value="" disabled>
                  {t("transactions.chooseCategory")}
                </option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>+ {t("transactions.newCategory")}</option>
              </select>
              </Field>
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
        </div>

        {type === "transfer" ? (
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        ) : null}

        {(type === "expense" || type === "income") && subcategories.length > 0 ? (
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

        <div className="flex flex-col gap-3">
          <Field label={t("transactions.date")}>
            <input
              type="datetime-local"
              className={inputClass}
              value={dateLocal}
              onChange={(e) => setDateLocal(e.target.value)}
            />
          </Field>
          <Field label={t("transactions.description")}>
            <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
        </div>

        <Field label={t("transactions.note")}>
          <textarea
            rows={3}
            className={`${inputClass} min-h-[88px] py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
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
