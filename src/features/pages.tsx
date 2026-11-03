import { useTranslation } from "react-i18next";
import { useTheme } from "../lib/theme-context";

interface PlaceholderProps {
  titleKey: string;
  emptyKey: string;
}

/** Page vide de Phase 0 : titre et message d'état vide, sans logique métier. */
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

export function TransactionsPage() {
  return (
    <PlaceholderPage titleKey="pages.transactions.title" emptyKey="pages.transactions.empty" />
  );
}

export function StatsPage() {
  return <PlaceholderPage titleKey="pages.stats.title" emptyKey="pages.stats.empty" />;
}

export function BudgetsPage() {
  return <PlaceholderPage titleKey="pages.budgets.title" emptyKey="pages.budgets.empty" />;
}

export function MorePage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("pages.more.title")}</h1>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("pages.more.theme")}</legend>
        {(["light", "dark"] as const).map((mode) => (
          <label
            key={mode}
            className="flex min-h-[44px] items-center gap-3 rounded-lg border border-slate-200 px-4 dark:border-slate-700"
          >
            <input
              type="radio"
              name="theme"
              value={mode}
              checked={theme === mode}
              onChange={() => setTheme(mode)}
              className="h-5 w-5"
            />
            {t(mode === "light" ? "pages.more.themeLight" : "pages.more.themeDark")}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
