import { Icon, type IconName } from "../../components/Icon";
import { PageTitle } from "../../components/PageHeader";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../lib/theme-context";
import { InstallCard } from "../../components/PwaComponents";
import { PreferencesSection } from "../settings/PreferencesSection";
import { ResetAccountSection } from "../settings/ResetAccountSection";

/** Ligne de liste cliquable avec chevron : pour les pages de réglages et de gestion. */
function NavRow({ to, icon, children }: { to: string; icon: IconName; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="pressable flex min-h-[52px] items-center justify-between gap-3 px-4 font-medium focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-ink dark:bg-raised dark:text-fg"
          >
            <Icon name={icon} className="h-4 w-4" />
          </span>
          {children}
        </span>
        <span aria-hidden="true" className="text-xl text-neutral-600">
          ›
        </span>
      </Link>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-neutral-600 dark:text-muted">
        {title}
      </h2>
      <div className="rounded-card border border-neutral-200 dark:border-white/15">{children}</div>
    </section>
  );
}

export function MorePage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <section className="flex flex-col gap-6">
      <PageTitle className="text-2xl font-semibold">{t("pages.more.title")}</PageTitle>

      <PreferencesSection />

      <Group title={t("more.groups.manage")}>
        <nav aria-label={t("more.groups.manage")}>
          <ul className="divide-y divide-neutral-100 dark:divide-white/10">
            <NavRow to="/plus/wallets" icon="wallet">
              {t("more.wallets")}
            </NavRow>
            <NavRow to="/plus/categories" icon="tag">
              {t("more.categories")}
            </NavRow>
            <NavRow to="/plus/recurring" icon="repeat">
              {t("more.recurring")}
            </NavRow>
            <NavRow to="/plus/goals" icon="target">
              {t("more.goals")}
            </NavRow>
            <NavRow to="/plus/debts" icon="balance">
              {t("more.debts")}
            </NavRow>
            <NavRow to="/plus/rates" icon="exchange">
              {t("more.rates")}
            </NavRow>
          </ul>
        </nav>
      </Group>

      <Group title={t("more.groups.data")}>
        <nav aria-label={t("more.groups.data")}>
          <ul className="divide-y divide-neutral-100 dark:divide-white/10">
            <NavRow to="/plus/security" icon="shield">
              {t("more.security")}
            </NavRow>
            <NavRow to="/plus/backup" icon="download">
              {t("more.backup")}
            </NavRow>
            <NavRow to="/plus/import" icon="upload">
              {t("more.import")}
            </NavRow>
          </ul>
        </nav>
      </Group>

      <Group title={t("resetAccount.group")}>
        <nav aria-label={t("resetAccount.group")}>
          <ul className="divide-y divide-neutral-100 dark:divide-white/10">
            <ResetAccountSection />
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
                className="h-5 w-5 accent-brand-600"
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
    </section>
  );
}
