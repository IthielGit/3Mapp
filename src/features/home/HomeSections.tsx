import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { Icon } from "../../components/Icon";
import { TransactionRow, WalletCard } from "../../components/TransactionRow";
import { formatMoney } from "../../lib/money";
import { buttonSecondary } from "../../components/FormControls";
import {
  canTransfer,
  capList,
  HOME_WALLET_LIMIT,
  reconcileTarget,
  showBudgetsSection,
  showRecentSection,
} from "../../domain/home-layout";
import type { HomeData } from "./useHomeData";

/**
 * En-tête de section : titre et lien « Tout voir ».
 * Même libellé partout ; le nom accessible précise la destination (« Voir toutes les transactions »).
 */
function SectionHeader({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="text-lg font-semibold text-ink dark:text-fg">{title}</h2>
      <Link
        to={to}
        aria-label={linkLabel}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-end px-2 text-sm font-medium text-neutral-600 underline dark:text-muted"
      >
        {t("home.layout.seeAll")}
      </Link>
    </div>
  );
}

/**
 * Portefeuilles : les quatre premiers avec leur solde, un lien vers les autres,
 * et les actions courantes entre comptes (virement, réconciliation).
 */
export function WalletsSection({
  active,
  balances,
  stale,
}: Pick<HomeData, "active" | "balances" | "stale">) {
  const { t } = useTranslation();
  if (active.length === 0) return null;
  const { shown, hiddenCount } = capList(active, HOME_WALLET_LIMIT);
  const target = reconcileTarget(active, stale);
  const reconcileTo =
    target?.kind === "wallet" ? `/plus/wallets/${target.walletId}/reconcile` : "/plus/wallets";
  const reconcileName =
    target?.kind === "wallet"
      ? active.find((w) => w.id === target.walletId)?.name ?? ""
      : undefined;
  const actionClass = `${buttonSecondary} inline-flex flex-1 items-center justify-center gap-2 text-sm`;
  // Le retard se lit sur la tuile (pastille « 47 j ») et se compte sur « Réconcilier » :
  // plus de bandeau au-dessus de la carte du mois.
  const staleDaysById = new Map(stale.map((s) => [s.wallet.id, s.daysSince]));
  const staleCount = stale.length;
  return (
    <section aria-labelledby="home-wallets-title" className="flex flex-col gap-3">
      <SectionHeader
        id="home-wallets-title"
        title={t("home.wallets")}
        to="/plus/wallets"
        linkLabel={t("home.layout.seeAllWallets")}
      />
      <ul className="grid grid-cols-2 gap-3">
        {shown.map((w) => (
          <li key={w.id} className="min-w-0">
            <WalletCard
              wallet={w}
              balance={balances[w.id] ?? w.initialBalance}
              staleDays={staleDaysById.get(w.id)}
            />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <Link
          to="/plus/wallets"
          className="inline-flex min-h-[44px] items-center self-start text-sm font-medium text-brand-700 underline dark:text-brand-dark"
        >
          {t("home.layout.moreWallets", { count: active.length })}
        </Link>
      ) : null}
      <div className="flex gap-3">
        {canTransfer(active.length) ? (
          <Link to="/transactions/new?type=transfer" className={actionClass}>
            {t("home.layout.transfer")}
          </Link>
        ) : null}
        {target ? (
          <Link
            to={reconcileTo}
            className={actionClass}
            aria-label={
              staleCount > 0 && reconcileName !== undefined
                ? t("home.layout.reconcileStale", { count: staleCount, name: reconcileName })
                : reconcileName !== undefined
                  ? t("home.layout.reconcileWallet", { name: reconcileName })
                  : t("home.layout.reconcileChoose")
            }
          >
            {staleCount > 0
              ? t("home.layout.reconcileCount", { count: staleCount })
              : t("home.layout.reconcile")}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** Échéances à venir : les trois prochaines récurrences. */
export function UpcomingSection({ upcoming, walletName }: Pick<HomeData, "upcoming" | "walletName">) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith("en") ? enUS : fr;
  if (upcoming.length === 0) return null;
  return (
    <section aria-labelledby="home-upcoming-title" className="flex flex-col gap-3">
      <SectionHeader
        id="home-upcoming-title"
        title={t("home.upcoming")}
        to="/plus/recurring"
        linkLabel={t("home.layout.seeAllUpcoming")}
      />
      <ul className="flex flex-col divide-y divide-neutral-200 rounded-3xl bg-white px-4 shadow-sm dark:divide-white/10 dark:bg-card">
        {upcoming.slice(0, 3).map((r) => {
          const due = new Date(r.nextDate);
          const income = r.type === "income";
          return (
            <li key={r.id}>
              <Link to={`/plus/recurring/${r.id}`} className="pressable flex min-h-[64px] items-center gap-3 py-3">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-center leading-none dark:bg-raised">
                  <span className="text-base font-semibold tabular-nums text-ink dark:text-fg">{format(due, "d")}</span>
                  <span className="mt-0.5 text-xs uppercase text-neutral-600 dark:text-muted">{format(due, "MMM", { locale: dateLocale })}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink dark:text-fg">
                    {r.memo || t(`transactions.types.${r.type}`)}
                  </span>
                  <span className="truncate text-xs text-neutral-600 dark:text-muted">{walletName(r.walletId)}</span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${income ? "text-income dark:text-income-dark" : "text-expense dark:text-expense-dark"}`}
                  data-amount
                >
                  {income ? "+" : "−"}
                  {formatMoney(r.amount, r.currency)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Budgets : les trois premiers, avec ce qui est dépensé et ce qui reste ; masqués au premier lancement. */
export function BudgetsSection({
  budgetRows,
  transactionCount,
}: Pick<HomeData, "budgetRows"> & { transactionCount: number }) {
  const { t } = useTranslation();
  if (!showBudgetsSection(budgetRows.length, transactionCount)) return null;
  return (
    <section aria-labelledby="home-budgets-title" className="flex flex-col gap-3">
      <SectionHeader
        id="home-budgets-title"
        title={t("home.budgetsTitle")}
        to="/budgets"
        linkLabel={t("home.layout.seeAllBudgets")}
      />
      {budgetRows.length === 0 ? (
        <Link
          to="/budgets/new"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 underline dark:text-brand-dark"
        >
          {t("home.budgetsEmpty")}
        </Link>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-3xl bg-white px-4 shadow-sm dark:divide-white/10 dark:bg-card">
          {budgetRows.slice(0, 3).map(({ budget, state }) => {
            const width = Math.min(100, Math.max(0, state.percent));
            const barColor =
              state.status === "exceeded"
                ? "bg-expense dark:bg-expense-dark"
                : state.status === "threshold"
                  ? "bg-amber-500"
                  : "bg-brand-600 dark:bg-brand-dark";
            return (
              <li key={budget.id} className="py-4">
                <Link to={`/budgets/${budget.id}`} className="pressable flex min-h-[44px] flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink dark:text-fg">{budget.name}</span>
                    <span className="shrink-0 tabular-nums text-neutral-600 dark:text-muted" data-amount>
                      {formatMoney(state.spent, budget.currency)} / {formatMoney(state.available, budget.currency)}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, state.percent)}
                    aria-label={budget.name}
                    className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-raised"
                  >
                    <div className={`progress-fill h-full rounded-full ${barColor}`} style={{ transform: `scaleX(${width / 100})` }} />
                  </div>
                  {state.status === "exceeded" ? (
                    <p className="text-xs font-medium text-expense dark:text-expense-dark">
                      {t("budgets.exceededBy", { amount: formatMoney(-state.remaining, budget.currency) })}
                    </p>
                  ) : state.status === "threshold" ? (
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {t("budgets.remaining", { amount: formatMoney(state.remaining, budget.currency) })}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Dernières transactions dans la devise de référence ; masquées tant qu'il n'y en a aucune. */
export function RecentSection({
  recent,
  categoryById,
  walletName,
  transactionCount,
}: Pick<HomeData, "recent" | "categoryById" | "walletName"> & { transactionCount: number }) {
  const { t } = useTranslation();
  if (!showRecentSection(recent.length, transactionCount)) return null;
  return (
    <section aria-labelledby="home-recent-title" className="flex flex-col gap-3">
      <SectionHeader
        id="home-recent-title"
        title={t("home.recent")}
        to="/transactions"
        linkLabel={t("home.layout.seeAllTransactions")}
      />
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 p-4 text-center text-sm text-neutral-600 dark:border-white/15 dark:text-muted">
          <Icon name="inbox" className="h-6 w-6 text-brand-600 dark:text-brand-dark" />
          <span>{t("home.noTransactions")}</span>
        </div>
      ) : (
        <ul className="flex flex-col">
          {recent.map((tx) => (
            <li key={tx.id}>
              <TransactionRow
                transaction={tx}
                category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                walletName={walletName}
                showDay
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
