import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { BottomSheet } from "../../components/BottomSheet";
import { buttonPrimary } from "../../components/FormControls";
import type { Category, Transaction } from "../../db/entities";
import { formatMoney } from "../../lib/money";

interface TransactionDetailSheetProps {
  transaction: Transaction;
  category?: Category | undefined;
  walletName: (id: string | undefined) => string;
  onClose: () => void;
  onEdit: () => void;
}

/**
 * Consultation d'une transaction : lecture seule. La modification passe par le bouton « Modifier »
 * (feuille d'édition), pour ne pas risquer une saisie accidentelle en simple consultation.
 */
export function TransactionDetailSheet({
  transaction: tx,
  category,
  walletName,
  onClose,
  onEdit,
}: TransactionDetailSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? enUS : fr;
  const isTransfer = tx.type === "transfer";
  const isExpense = tx.type === "expense";
  const isIncome = tx.type === "income" || (tx.type === "adjustment" && tx.amount > 0);
  const tone = isExpense
    ? "text-expense dark:text-expense-dark"
    : isIncome
      ? "text-income dark:text-income-dark"
      : "text-ink dark:text-fg";
  const sign = isExpense ? "−" : tx.type === "income" ? "+" : "";

  const rows: Array<{ label: string; value: string }> = [];
  if (!isTransfer) {
    rows.push({ label: t("transactions.category"), value: category?.name ?? "—" });
  }
  rows.push({
    label: isTransfer ? t("transactions.fromWallet") : t("transactions.wallet"),
    value: walletName(tx.walletId) || "—",
  });
  if (isTransfer) {
    rows.push({ label: t("transactions.toWallet"), value: walletName(tx.toWalletId) || "—" });
  }
  if (tx.memo) rows.push({ label: t("transactions.memo"), value: tx.memo });

  return (
    <BottomSheet
      open
      title={t(`transactions.types.${tx.type}`)}
      onClose={onClose}
      footer={
        <button type="button" className={`${buttonPrimary} w-full`} onClick={onEdit}>
          {t("common.edit")}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm text-slate-600 dark:text-muted">
            {format(new Date(tx.date), "EEEE d MMMM yyyy · HH:mm", { locale })}
          </p>
          <p className={`text-3xl font-semibold tabular-nums ${tone}`} data-amount>
            {sign}
            {formatMoney(tx.amount, tx.currency)}
          </p>
        </div>

        <dl className="flex flex-col divide-y divide-slate-200 dark:divide-white/10">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="shrink-0 text-sm text-slate-600 dark:text-muted">{row.label}</dt>
              <dd className="min-w-0 break-words text-right font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </BottomSheet>
  );
}
