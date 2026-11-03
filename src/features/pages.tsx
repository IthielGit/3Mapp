import { useTranslation } from "react-i18next";

interface PlaceholderProps {
  titleKey: string;
  emptyKey: string;
}

/** Page encore vide : titre et message d'état vide. Les écrans restants arrivent en Phases 5 et 6. */
function PlaceholderPage({ titleKey, emptyKey }: PlaceholderProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t(titleKey)}</h1>
      <p className="text-slate-500 dark:text-slate-400">{t(emptyKey)}</p>
    </section>
  );
}

export function HomePage() {
  return <PlaceholderPage titleKey="pages.home.title" emptyKey="pages.home.empty" />;
}

export function StatsPage() {
  return <PlaceholderPage titleKey="pages.stats.title" emptyKey="pages.stats.empty" />;
}

export function BudgetsPage() {
  return <PlaceholderPage titleKey="pages.budgets.title" emptyKey="pages.budgets.empty" />;
}
