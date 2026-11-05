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
import { deleteWallet, setWalletArchived } from "./wallet-service";
import { useBalanceCutoff } from "../settings/balance-cutoff";

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
    if (!window.confirm(t("wallets.deleteConfirm"))) return;
    try {
      await deleteWallet(id);
      navigate("/plus/wallets", { replace: true });
    } catch (err) {
      if (err instanceof InUseError) setError(t("wallets.deleteBlocked"));
      else setError(t("errors.generic"));
    }
  }

  const walletActions: MenuItem[] = [
    { label: t("common.edit"), to: `/plus/wallets/${id}/edit` },
    { label: t("reconcile.open"), to: `/plus/wallets/${id}/reconcile` },
    wallet.archived
      ? { label: t("common.restore"), onSelect: () => void setWalletArchived(id, false) }
      : { label: t("common.archive"), onSelect: () => void setWalletArchived(id, true) },
    { label: t("common.delete"), onSelect: () => void remove(), danger: true },
  ];

  return (
    <section className="flex flex-col gap-4">
      <DetailHeader title={wallet.name} actions={<ActionMenu items={walletActions} />}>
        <p className="text-center text-sm text-slate-600 dark:text-muted">
          {wallet.icon} {t(`groups.${wallet.group}`)}
          {wallet.archived ? ` · ${t("wallets.archivedBadge")}` : ""}
        </p>
      </DetailHeader>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-white/15">
        <p className="text-sm text-slate-600">{t("wallets.balance")}</p>
        <p className="text-2xl font-semibold">{formatMoney(balance, wallet.currency)}</p>
        <p className="mt-2 text-sm text-slate-600">
          {t("wallets.initialBalance")} : {formatMoney(wallet.initialBalance, wallet.currency)}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("wallets.movements")}</h2>
        {(movements ?? []).length === 0 ? (
          <p className="text-slate-600">{t("wallets.noMovements")}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(movements ?? []).slice(0, 30).map((tx) => (
            <li key={tx.id}>
              <Link
                to={`/transactions/${tx.id}/edit`}
                className="flex justify-between rounded-lg border border-slate-200 p-3 dark:border-white/15"
              >
                <span className="text-sm">
                  {format(new Date(tx.date), "dd/MM/yyyy HH:mm")} ·{" "}
                  {t(`transactions.types.${tx.type}`)}
                  {tx.memo ? ` · ${tx.memo}` : ""}
                </span>
                <span className="font-medium">{formatMoney(tx.amount, tx.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
