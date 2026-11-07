import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Category, Transaction, Wallet } from "../db/entities";
import { formatMoney, formatMoneyCompact } from "../lib/money";
import { readableTextOn } from "../lib/contrast";
import { fitsWalletCard } from "../lib/amount-fit";

/** Pastille sans catégorie : neutral-500 (DESIGN.md field-border), gris froid. */
const NO_CATEGORY_COLOR = "#6C787F";

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category | undefined;
  walletName: (id: string | undefined) => string;
  /** Si fourni, la ligne ouvre la fiche au lieu d'un lien (ex. calendrier). */
  onOpen?: () => void;
}

/**
 * Une ligne de transaction : pastille de catégorie, libellé, portefeuille et heure,
 * montant aligné à droite. Couleur sémantique : dépense en rouge, revenu en bleu.
 */
export function TransactionRow({ transaction: tx, category, walletName, onOpen }: TransactionRowProps) {
  const { t } = useTranslation();
  const isExpense = tx.type === "expense";
  const isIncome = tx.type === "income";
  const amountClass = isExpense
    ? "text-expense dark:text-expense-dark"
    : isIncome
      ? "text-income dark:text-income-dark"
      : "text-neutral-700 dark:text-neutral-200";
  const title =
    tx.type === "transfer"
      ? `${walletName(tx.walletId)} → ${walletName(tx.toWalletId)}`
      : tx.memo || category?.name || t(`transactions.types.${tx.type}`);
  const subtitle =
    tx.type === "transfer"
      ? t("transactions.types.transfer")
      : [category?.name, walletName(tx.walletId)].filter(Boolean).join(" · ");
  const time = new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const className = "flex min-h-[64px] w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors duration-150 active:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:active:bg-neutral-800";
  const content = (
    <>
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-white"
        style={{ backgroundColor: category?.color ?? NO_CATEGORY_COLOR }}
      >
        {category?.icon ?? "•"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-xs text-neutral-600 dark:text-muted">{subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className={`whitespace-nowrap font-semibold tabular-nums ${amountClass}`} data-amount>
          {isExpense ? "−" : isIncome ? "+" : ""}
          {formatMoney(tx.amount, tx.currency)}
        </span>
        <span className="text-xs text-neutral-600 dark:text-muted">{time}</span>
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className={className}>
      {content}
    </button>
  ) : (
    <Link to={`/transactions/${tx.id}`} className={className}>
      {content}
    </Link>
  );
}

/**
 * Carte de portefeuille : pleine, à la couleur du portefeuille, plate au repos (effleurement seul).
 * Le texte (Encre Charbon ou blanc) est choisi par contraste WCAG avec la couleur choisie.
 * Un solde trop long pour la carte passe au format compact ; le montant complet reste lu et en infobulle.
 */
export function WalletCard({ wallet, balance }: { wallet: Wallet; balance: number }) {
  const { i18n } = useTranslation();
  const textClass = readableTextOn(wallet.color) === "ink" ? "text-ink" : "text-white";
  const full = formatMoney(balance, wallet.currency);
  const shown = fitsWalletCard(full)
    ? full
    : formatMoneyCompact(balance, wallet.currency, i18n.language.startsWith("en") ? "en" : "fr");
  return (
    <Link
      to={`/plus/wallets/${wallet.id}`}
      className={`flex min-w-0 flex-col gap-2 rounded-card p-3 shadow-sm ${textClass}`}
      style={{ backgroundColor: wallet.color }}
    >
      <span aria-hidden="true" className="text-2xl">
        {wallet.icon}
      </span>
      <span className="truncate text-sm font-medium">{wallet.name}</span>
      {shown === full ? (
        <span className="font-semibold" data-amount>
          {full}
        </span>
      ) : (
        <span className="font-semibold" data-amount title={full}>
          <span aria-hidden="true">{shown}</span>
          <span className="sr-only">{full}</span>
        </span>
      )}
    </Link>
  );
}
