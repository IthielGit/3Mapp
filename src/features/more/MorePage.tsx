import { PageTitle } from "../../components/PageHeader";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../lib/theme-context";
import { buttonSecondary } from "../../components/FormControls";
import { generateDemoTransactions } from "../demo/demo-data";
import { InstallCard } from "../../components/PwaComponents";
import { PreferencesSection } from "../settings/PreferencesSection";

/** Ligne de liste cliquable avec chevron : pour les pages de réglages et de gestion. */
function NavRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-[52px] items-center justify-between gap-3 px-4 font-medium focus-visible:outline-2 focus-visible:outline-brand-700"
      >
        <span>{children}</span>
        <span aria-hidden="true" className="text-xl text-slate-400">
          ›
        </span>
      </Link>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted">
        {title}
      </h2>
      <div className="rounded-card border border-slate-200 dark:border-slate-700">{children}</div>
    </section>
  );
}

export function MorePage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [demoMessage, setDemoMessage] = useState<string | undefined>();

  async function addDemo() {
    setDemoMessage(undefined);
    try {
      const count = await generateDemoTransactions(5000);
      setDemoMessage(t("more.demoDone", { count }));
    } catch (err) {
      setDemoMessage(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageTitle className="text-2xl font-bold">{t("pages.more.title")}</PageTitle>

      <PreferencesSection />

      <Group title={t("more.groups.manage")}>
        <nav aria-label={t("more.groups.manage")}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <NavRow to="/plus/wallets">{t("more.wallets")}</NavRow>
            <NavRow to="/plus/categories">{t("more.categories")}</NavRow>
            <NavRow to="/plus/recurring">{t("more.recurring")}</NavRow>
            <NavRow to="/plus/goals">{t("more.goals")}</NavRow>
            <NavRow to="/plus/debts">{t("more.debts")}</NavRow>
            <NavRow to="/plus/rates">{t("more.rates")}</NavRow>
          </ul>
        </nav>
      </Group>

      <Group title={t("more.groups.data")}>
        <nav aria-label={t("more.groups.data")}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <NavRow to="/plus/security">{t("more.security")}</NavRow>
            <NavRow to="/plus/backup">{t("more.backup")}</NavRow>
            <NavRow to="/plus/import">{t("more.import")}</NavRow>
          </ul>
        </nav>
      </Group>

      <InstallCard />

      <Group title={t("more.groups.appearance")}>
        <fieldset className="flex flex-col">
          <legend className="sr-only">{t("pages.more.theme")}</legend>
          {(["system", "light", "dark"] as const).map((mode) => (
            <label
              key={mode}
              className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 font-medium"
            >
              <input
                type="radio"
                name="theme"
                value={mode}
                checked={theme === mode}
                onChange={() => setTheme(mode)}
                className="h-5 w-5 accent-brand-700"
              />
              {t(
                mode === "system"
                  ? "pages.more.themeSystem"
                  : mode === "light"
                    ? "pages.more.themeLight"
                    : "pages.more.themeDark",
              )}
            </label>
          ))}
        </fieldset>
      </Group>

      <Group title={t("more.demo")}>
        <div className="flex flex-col gap-2 p-4">
          <p className="text-sm text-slate-500 dark:text-muted">{t("more.demoHint")}</p>
          <button type="button" className={buttonSecondary} onClick={() => void addDemo()}>
            {t("more.demoButton")}
          </button>
          {demoMessage ? (
            <p role="status" className="text-sm">
              {demoMessage}
            </p>
          ) : null}
        </div>
      </Group>
    </section>
  );
}
