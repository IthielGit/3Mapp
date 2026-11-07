import { useTranslation } from "react-i18next";
import { useHomeData } from "./useHomeData";
import { HomeHeader } from "./HomeHeader";
import { HomeSkeleton } from "./HomeSkeleton";
import { HomeAlerts } from "./HomeBanners";
import { CycleHero } from "./CycleHero";
import { BudgetsSection, RecentSection, UpcomingSection, WalletsSection } from "./HomeSections";

/**
 * Accueil : en-tête et état des données, carte du mois, portefeuilles (soldes, retards de saisie,
 * virement et réconciliation), alertes, dernières transactions, échéances, budgets.
 * Le graphique des 7 jours vit dans Visualisation.
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
      {/* Le solde vrai de chaque portefeuille, juste sous la carte : principe n°1 du produit. */}
      <WalletsSection active={data.active} balances={data.balances} stale={data.stale} />
      <HomeAlerts backupState={data.backupState} pendingCount={data.pendingCount} />
      <RecentSection
        recent={data.recent}
        categoryById={data.categoryById}
        walletName={data.walletName}
        transactionCount={data.transactions.length}
      />
      <UpcomingSection upcoming={data.upcoming} walletName={data.walletName} />
      <BudgetsSection budgetRows={data.budgetRows} transactionCount={data.transactions.length} />
    </section>
  );
}
