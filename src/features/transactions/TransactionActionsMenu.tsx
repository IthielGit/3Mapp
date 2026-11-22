import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../../components/BottomSheet";
import { askConfirm } from "../../components/confirm-service";
import { announce } from "../../components/announce";
import type { Transaction } from "../../db/entities";
import { removeTransactions } from "./transaction-service";

const itemClass =
  "flex min-h-[52px] w-full items-center rounded-xl px-3 text-left text-base font-medium text-ink hover:bg-neutral-100 active:bg-neutral-100 dark:text-fg dark:hover:bg-white/10 dark:active:bg-white/10";

interface Options {
  /** Remplace la suppression par défaut (confirmation puis suppression) : la page Transactions gère l'annulation. */
  onDelete?: (tx: Transaction) => void;
  /** Ajoute « Sélectionner » (liste avec sélection multiple) : entre en mode sélection avec cette ligne. */
  onSelect?: (tx: Transaction) => void;
}

/**
 * Menu d'options d'une transaction, ouvert par un appui long sur sa ligne : modifier, dupliquer,
 * sélectionner (si la liste le permet), supprimer. `open(tx, title)` ouvre le menu ; `menu` est à rendre dans la page.
 */
export function useTransactionMenu({ onDelete, onSelect }: Options = {}): {
  open: (tx: Transaction, title: string) => void;
  menu: ReactNode;
} {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [target, setTarget] = useState<{ tx: Transaction; title: string } | null>(null);

  async function defaultDelete(tx: Transaction) {
    if (!(await askConfirm({ message: t("transactions.confirmDelete", { count: 1 }) }))) return;
    await removeTransactions([tx.id]);
    announce(t("a11y.deleted"));
  }

  const close = () => setTarget(null);
  const run = (action: (tx: Transaction) => void) => {
    if (!target) return;
    const { tx } = target;
    close();
    action(tx);
  };

  const menu = (
    <BottomSheet open={target !== null} title={target?.title ?? ""} onClose={close}>
      <ul className="flex flex-col gap-1">
        <li>
          <button
            type="button"
            className={itemClass}
            onClick={() => run((tx) => navigate(`/transactions/${tx.id}/edit`))}
          >
            {t("common.edit")}
          </button>
        </li>
        <li>
          <button
            type="button"
            className={itemClass}
            onClick={() => run((tx) => navigate(`/transactions/new?from=${tx.id}`))}
          >
            {t("transactions.duplicate")}
          </button>
        </li>
        {onSelect ? (
          <li>
            <button type="button" className={itemClass} onClick={() => run(onSelect)}>
              {t("transactions.select")}
            </button>
          </li>
        ) : null}
        <li>
          <button
            type="button"
            className={`${itemClass} !text-expense dark:!text-expense-dark`}
            onClick={() => run((tx) => void (onDelete ?? defaultDelete)(tx))}
          >
            {t("common.delete")}
          </button>
        </li>
      </ul>
    </BottomSheet>
  );

  return { open: (tx, title) => setTarget({ tx, title }), menu };
}
