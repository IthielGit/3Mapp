import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { computeBalances } from "../../domain/balance";
import { backupReminder } from "../../domain/backup";
import { convertedSum } from "../../domain/fx";
import { EmptyState, Skeleton } from "../../components/PwaComponents";
import { TransactionRow, WalletCard } from "../../components/TransactionRow";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { useBalanceCutoff } from "../settings/balance-cutoff";

const EMPTY: never[] = [];
const PREVIEW = 5;

/** Icône ronde du bouton secondaire (récurrences : échéances en attente). */
function RoundIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </svg>
  );
}

/**
 * Tableau de bord : marque et action secondaire en haut, solde total centré, cartes de
 * portefeuilles en défilement horizontal, et un panneau d'aperçu des transactions récentes.
 */
export function HomePage() {
  const { t } = useTranslation();
  const rates = useLiveQuery(() => db.exchangeRates.toArray(), []) ?? EMPTY;
  const walletsLoaded = useLiveQuery(() => db.wallets.orderBy("sortOrder").toArray(), []);
  const loading = walletsLoaded === undefined;
  const wallets = walletsLoaded ?? EMPTY;
  const transactions =
    useLiveQuery(() => db.transactions.orderBy("date").reverse().toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const baseCurrency: CurrencyCode =
    useLiveQuery(async () => (await db.settings.toArray())[0]?.baseCurrency, []) ?? "MGA";
  const pendingCount =
    useLiveQuery(() => db.transactions.where("status").equals("pending").count(), []) ?? 0;
  const lastBackupAt = useLiveQuery(
    async () => (await db.settings.toCollection().first())?.lastBackupAt,
    [],
  );

  const backupState = backupReminder(lastBackupAt, new Date(), transactions.length > 0);
  const active = wallets.filter((w) => !w.archived);
  const cutoff = useBalanceCutoff();
  const balances = useMemo(
    () => computeBalances(active, transactions, cutoff),
    [active, transactions, cutoff],
  );
  const converted = convertedSum(
    active
      .filter((w) => w.includeInTotal)
      .map((w) => ({
        amount: balances[w.id] ?? w.initialBalance,
        currency: w.currency,
        date: new Date().toISOString(),
      })),
    baseCurrency,
    rates,
  );
  const recent = transactions.filter((tx) => tx.currency === baseCurrency).slice(0, PREVIEW);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const walletName = (id: string | undefined) => active.find((w) => w.id === id)?.name ?? "";

  return (
    <section className="-mx-4 flex flex-col">
      <h1 className="sr-only">{t("nav.home")}</h1>

      {/* En-tête : marque à gauche, action secondaire ronde à droite. */}
      <header className="flex items-center justify-between px-4 pb-2 pt-1">
        <span className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-fg">
          <span aria-hidden="true" className="inline-block h-6 w-6 rounded-md bg-accent" />
          {t("app.title")}
        </span>
        <Link
          to="/plus/recurring"
          aria-label={t("more.recurring")}
          className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
        >
          <RoundIcon />
          {pendingCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent"
            />
          ) : null}
        </Link>
      </header>

      {backupState !== "none" || pendingCount > 0 ? (
        <div className="flex flex-col gap-2 px-4">
          {backupState !== "none" ? (
            <Link
              to="/plus/backup"
              className="rounded-2xl bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              {t("home.backupReminder")}
            </Link>
          ) : null}
          {pendingCount > 0 ? (
            <Link
              to="/plus/recurring"
              className="rounded-2xl bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              {t("home.pendingBanner", { count: pendingCount })}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Indicateur principal, centré sous l'en-tête. */}
      <div className="flex flex-col items-center gap-1 px-4 pb-6 pt-4 text-center">
        <p className="text-sm text-slate-500 dark:text-muted">{t("home.totalBalance")}</p>
        {loading ? (
          <Skeleton className="h-11 w-48" />
        ) : (
          <p className="text-4xl font-semibold tabular-nums text-ink dark:text-fg" data-amount>
            {formatMoney(converted.total, baseCurrency)}
          </p>
        )}
        {converted.missing.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t("home.missingRate", { currencies: converted.missing.join(", ") })}
          </p>
        ) : null}
      </div>

      {/* Cartes de portefeuilles : la suivante reste entrevue au bord. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-4">
          <h2 className="font-semibold text-ink dark:text-fg">{t("home.wallets")}</h2>
          <Link
            to="/plus/wallets"
            className="text-sm font-medium text-slate-500 underline dark:text-muted"
          >
            {t("home.manage")}
          </Link>
        </div>
        <ul className="flex snap-x gap-3 overflow-x-auto pl-4 pr-10 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {active.map((w) => (
            <li key={w.id} className="snap-start">
              <WalletCard wallet={w} balance={balances[w.id] ?? w.initialBalance} />
            </li>
          ))}
        </ul>
      </section>

      {/* Panneau : coins supérieurs arrondis, recouvre légèrement le bas des cartes. */}
      <section className="relative z-10 -mt-5 flex flex-col gap-1 rounded-t-3xl bg-white px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(26,26,27,0.06)] dark:bg-card">
        <span
          aria-hidden="true"
          className="mx-auto mb-2 h-1 w-12 rounded-full bg-slate-300 dark:bg-raised"
        />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-fg">{t("home.recent")}</h2>
          <Link
            to="/transactions"
            className="text-sm font-medium text-slate-500 underline dark:text-muted"
          >
            {t("home.seeAll")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon="🧾" title={t("home.noTransactions")} />
        ) : (
          <ul className="flex flex-col">
            {recent.map((tx) => (
              <li key={tx.id}>
                <TransactionRow
                  transaction={tx}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                  walletName={walletName}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
