import { useTranslation } from "react-i18next";
import { useHomeData } from "./useHomeData";
import { HomeHeader } from "./HomeHeader";
import { HomeSkeleton } from "./HomeSkeleton";
import { HomeAlerts, StaleWalletBanner } from "./HomeBanners";
import { CycleHero } from "./CycleHero";
import { BudgetsSection, RecentSection, UpcomingSection, WalletsSection, WeekChart } from "./HomeSections";

/**
 * Accueil : en-tête, alerte de saisie en retard, carte du mois, alertes, dépenses de la semaine,
 * portefeuilles, échéances, budgets et dernières transactions.
 * Les données viennent de useHomeData ; chaque bloc vit dans son propre composant.
 */
export function HomePage() {
  const { t } = useTranslation();
  const data = useHomeData();
  if (!data.loaded) return <HomeSkeleton />;

  return (
    <section className="-mx-4 flex flex-col gap-5 px-4">
      <h1 className="sr-only">{t("nav.home")}</h1>
      <HomeHeader />
      <StaleWalletBanner stale={data.stale} />
      <CycleHero
        cycleView={data.cycleView}
        baseCurrency={data.baseCurrency}
        categories={data.categories}
        incomeCategories={data.incomeCategories}
        active={data.active}
        transactions={data.transactions}
        payAnswered={data.payAnswered}
        monthStartDay={data.monthStartDay}
      />
      <HomeAlerts backupState={data.backupState} pendingCount={data.pendingCount} />
      <WeekChart
        weekExpenses={data.weekExpenses}
        weekTotalMinor={data.weekTotalMinor}
        baseCurrency={data.baseCurrency}
      />
      <WalletsSection active={data.active} balances={data.balances} />
      <UpcomingSection upcoming={data.upcoming} walletName={data.walletName} />
      <BudgetsSection budgetRows={data.budgetRows} />
      <RecentSection recent={data.recent} categoryById={data.categoryById} walletName={data.walletName} />
    </section>
  );
}
