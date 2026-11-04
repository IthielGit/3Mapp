import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Category, Transaction, Wallet } from "../db/entities";
import { formatMoney } from "../lib/money";

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category | undefined;
  walletName: (id: string | undefined) => string;
}

/**
 * Une ligne de transaction : pastille de catégorie, libellé, portefeuille et heure,
 * montant aligné à droite. Couleur sémantique : dépense en rouge, revenu en bleu.
 */
export function TransactionRow({ transaction: tx, category, walletName }: TransactionRowProps) {
  const { t } = useTranslation();
  const isExpense = tx.type === "expense";
  const isIncome = tx.type === "income";
  const amountClass = isExpense
    ? "text-expense dark:text-expense-dark"
    : isIncome
      ? "text-income dark:text-income-dark"
      : "text-slate-700 dark:text-slate-200";
  const title =
    tx.type === "transfer"
      ? `${walletName(tx.walletId)} → ${walletName(tx.toWalletId)}`
      : tx.memo || category?.name || t(`transactions.types.${tx.type}`);
  const subtitle =
    tx.type === "transfer"
      ? t("transactions.types.transfer")
      : [category?.name, walletName(tx.walletId)].filter(Boolean).join(" · ");
  const time = new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Link
      to={`/transactions/${tx.id}/edit`}
      className="flex min-h-[64px] items-center gap-3 rounded-lg px-1 py-2 transition-colors duration-150 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-700 dark:active:bg-slate-800"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-white"
        style={{ backgroundColor: category?.color ?? "#64748b" }}
      >
        {category?.icon ?? "•"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-sm text-slate-500 dark:text-muted">{subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className={`font-semibold ${amountClass}`} data-amount>
          {isExpense ? "−" : isIncome ? "+" : ""}
          {formatMoney(tx.amount, tx.currency)}
        </span>
        <span className="text-xs text-slate-500 dark:text-muted">{time}</span>
      </span>
    </Link>
  );
}

/** Carte de portefeuille : couleur du portefeuille, icône et solde. */
export function WalletCard({ wallet, balance }: { wallet: Wallet; balance: number }) {
  return (
    <Link
      to={`/plus/wallets/${wallet.id}`}
      className="flex min-w-[9.5rem] flex-col gap-2 rounded-card p-3 text-white shadow-sm"
      style={{ backgroundColor: wallet.color }}
    >
      <span aria-hidden="true" className="text-2xl">
        {wallet.icon}
      </span>
      <span className="truncate text-sm font-medium opacity-95">{wallet.name}</span>
      <span className="font-semibold" data-amount>
        {formatMoney(balance, wallet.currency)}
      </span>
    </Link>
  );
}
