import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { InUseError } from "../../db/errors";
import { buttonDanger, buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { walletBalance } from "../../domain/balance";
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

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl" style={{ color: wallet.color }}>
          {wallet.icon}
        </span>
        <div>
          <h1 className="text-2xl font-bold">{wallet.name}</h1>
          <p className="text-sm text-slate-500">
            {t(`groups.${wallet.group}`)}
            {wallet.archived ? ` · ${t("wallets.archivedBadge")}` : ""}
          </p>
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-sm text-slate-500">{t("wallets.balance")}</p>
        <p className="text-2xl font-semibold">{formatMoney(balance, wallet.currency)}</p>
        <p className="mt-2 text-sm text-slate-500">
          {t("wallets.initialBalance")} : {formatMoney(wallet.initialBalance, wallet.currency)}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("wallets.movements")}</h2>
        {(movements ?? []).length === 0 ? (
          <p className="text-slate-500">{t("wallets.noMovements")}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(movements ?? []).slice(0, 30).map((tx) => (
            <li key={tx.id}>
              <Link
                to={`/transactions/${tx.id}/edit`}
                className="flex justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
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

      <div className="flex flex-col gap-2">
        <Link
          to={`/plus/wallets/${id}/edit`}
          className={buttonPrimary + " inline-flex items-center justify-center"}
        >
          {t("common.edit")}
        </Link>
        <Link
          to={`/plus/wallets/${id}/reconcile`}
          className={buttonSecondary + " inline-flex items-center justify-center"}
        >
          {t("reconcile.open")}
        </Link>
        {wallet.archived ? (
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => setWalletArchived(id, false)}
          >
            {t("common.restore")}
          </button>
        ) : (
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => setWalletArchived(id, true)}
          >
            {t("common.archive")}
          </button>
        )}
        <button type="button" className={buttonDanger} onClick={remove}>
          {t("common.delete")}
        </button>
        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
