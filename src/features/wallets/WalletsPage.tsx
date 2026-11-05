import { PageTitle } from "../../components/PageHeader";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import type { Wallet } from "../../db/entities";
import { buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { computeBalances } from "../../domain/balance";
import { formatMoney } from "../../lib/money";
import { setWalletArchived } from "./wallet-service";
import { useBalanceCutoff } from "../settings/balance-cutoff";

const EMPTY: never[] = [];

export function WalletsPage() {
  const { t } = useTranslation();
  const wallets = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const cutoff = useBalanceCutoff();
  const balances = useMemo(
    () => computeBalances(wallets ?? [], transactions, cutoff),
    [wallets, transactions, cutoff],
  );
  if (!wallets) return null;

  const active = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <PageTitle className="text-2xl font-semibold">{t("wallets.title")}</PageTitle>
        <Link to="/plus/wallets/new" className={buttonPrimary + " inline-flex items-center"}>
          {t("common.add")}
        </Link>
      </header>

      {active.length === 0 ? <p className="text-neutral-600 dark:text-muted">{t("wallets.empty")}</p> : null}

      <ul className="flex flex-col gap-2">
        {active.map((wallet) => (
          <WalletRow key={wallet.id} wallet={wallet} balance={balances[wallet.id] ?? wallet.initialBalance} />
        ))}
      </ul>

      {archived.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-neutral-600 dark:text-muted">{t("wallets.archivedSection")}</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((wallet) => (
              <li
                key={wallet.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 dark:border-white/15"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{wallet.icon}</span>
                  {wallet.name}
                </span>
                <div className="flex gap-2">
                  <Link
                    to={`/plus/wallets/${wallet.id}`}
                    className={buttonSecondary + " inline-flex items-center"}
                  >
                    {t("common.open")}
                  </Link>
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={() => setWalletArchived(wallet.id, false)}
                  >
                    {t("common.restore")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function WalletRow({ wallet, balance }: { wallet: Wallet; balance: number }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/plus/wallets/${wallet.id}`}
        className="flex items-center gap-3 rounded-card border border-neutral-200 p-3 shadow-sm dark:border-white/15"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: wallet.color }}
        >
          {wallet.icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{wallet.name}</span>
          <span className="text-sm text-neutral-600 dark:text-muted">
            {t("wallets.balance")} :{" "}
            <span data-amount>{formatMoney(balance, wallet.currency)}</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-xl text-neutral-600">›</span>
      </Link>
    </li>
  );
}
