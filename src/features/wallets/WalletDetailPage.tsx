import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { InUseError } from "../../db/errors";
import { walletBalance } from "../../domain/balance";
import { ActionMenu, DetailHeader, type MenuItem } from "../../components/DetailHeader";
import { formatMoney } from "../../lib/money";
import { deleteWallet, moveWallet, setWalletArchived } from "./wallet-service";
import { buttonDanger, buttonPrimary } from "../../components/FormControls";
import { useBalanceCutoff } from "../settings/balance-cutoff";
import { askConfirm } from "../../components/confirm-service";

export function WalletDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const wallet = useLiveQuery(() => db.wallets.get(id), [id]);
  const movements = useLiveQuery(
    async () =>
      (
        await db.transactions.filter((tx) => tx.walletId === id || tx.toWalletId === id).toArray()
      ).sort((a, b) => b.date.localeCompare(a.date)),
    [id],
  );
  const [error, setError] = useState<string | undefined>();
  const cutoff = useBalanceCutoff();

  if (wallet === undefined) return null;
  if (!wallet) return <p>{t("wallets.notFound")}</p>;

  const balance = walletBalance(wallet, movements ?? [], cutoff);

  async function remove() {
    setError(undefined);
    if (!(await askConfirm({ message: t("wallets.deleteConfirm") }))) return;
    try {
      await deleteWallet(id);
      navigate("/plus/wallets", { replace: true });
    } catch (err) {
      if (err instanceof InUseError) setError(t("wallets.deleteBlocked"));
      else setError(t("errors.generic"));
    }
  }

  const walletActions: MenuItem[] = [
    { label: t("reconcile.open"), to: `/plus/wallets/${id}/reconcile` },
    { label: t("common.moveUp"), onSelect: () => void moveWallet(id, -1) },
    { label: t("common.moveDown"), onSelect: () => void moveWallet(id, 1) },
    wallet.archived
      ? { label: t("common.restore"), onSelect: () => void setWalletArchived(id, false) }
      : { label: t("common.archive"), onSelect: () => void setWalletArchived(id, true) },
  ];

  return (
    <section className="flex flex-col gap-4">
      <DetailHeader title={wallet.name} actions={<ActionMenu items={walletActions} />}>
        <p className="text-center text-sm text-neutral-600 dark:text-muted">
          {wallet.icon} {t(`groups.${wallet.group}`)}
          {wallet.archived ? ` · ${t("wallets.archivedBadge")}` : ""}
        </p>
      </DetailHeader>

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/15">
        <p className="text-sm text-neutral-600 dark:text-muted">{t("wallets.balance")}</p>
        <p className="text-2xl font-semibold">{formatMoney(balance, wallet.currency)}</p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-muted">
          {t("wallets.initialBalance")} : {formatMoney(wallet.initialBalance, wallet.currency)}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("wallets.movements")}</h2>
        {(movements ?? []).length === 0 ? (
          <p className="text-neutral-600 dark:text-muted">{t("wallets.noMovements")}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(movements ?? []).slice(0, 30).map((tx) => {
            // Une réconciliation négative est une perte (dépense), une positive un gain (revenu).
            const outflow = tx.type === "expense" || (tx.type === "adjustment" && tx.amount < 0);
            const inflow = tx.type === "income" || (tx.type === "adjustment" && tx.amount > 0);
            return (
              <li key={tx.id}>
                <Link
                  to={`/transactions/${tx.id}`}
                  className="flex justify-between rounded-lg border border-neutral-200 p-3 dark:border-white/15"
                >
                  <span className="text-sm">
                    {format(new Date(tx.date), "dd/MM/yyyy HH:mm")} ·{" "}
                    {t(`transactions.types.${tx.type}`)}
                    {tx.memo ? ` · ${tx.memo}` : ""}
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      outflow
                        ? "text-expense dark:text-expense-dark"
                        : inflow
                          ? "text-income dark:text-income-dark"
                          : ""
                    }`}
                    data-amount
                  >
                    {outflow ? "−" : inflow ? "+" : ""}
                    {formatMoney(Math.abs(tx.amount), tx.currency)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/plus/wallets/${id}/edit`} className={`${buttonPrimary} inline-flex items-center justify-center`}>
          {t("common.edit")}
        </Link>
        <button type="button" className={buttonDanger} onClick={() => void remove()}>
          {t("common.delete")}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
