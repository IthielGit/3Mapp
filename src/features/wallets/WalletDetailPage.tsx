import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { InUseError } from "../../db/errors";
import { buttonDanger, buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { formatMoney } from "../../lib/money";
import { deleteWallet, setWalletArchived } from "./wallet-service";

export function WalletDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const wallet = useLiveQuery(() => db.wallets.get(id), [id]);
  const [error, setError] = useState<string | undefined>();

  if (wallet === undefined) return null;
  if (!wallet) return <p>{t("wallets.notFound")}</p>;

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
        <p className="text-sm text-slate-500">{t("wallets.initialBalance")}</p>
        <p className="text-2xl font-semibold">
          {formatMoney(wallet.initialBalance, wallet.currency)}
        </p>
        <p className="mt-2 text-sm text-slate-500">{t("wallets.movementsLater")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          to={`/plus/wallets/${id}/edit`}
          className={buttonPrimary + " inline-flex items-center justify-center"}
        >
          {t("common.edit")}
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
