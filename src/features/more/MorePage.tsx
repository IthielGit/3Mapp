import { Icon, type IconName } from "../../components/Icon";
import { PageTitle } from "../../components/PageHeader";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InstallCard } from "../../components/PwaComponents";
import { PreferencesSection } from "../settings/PreferencesSection";
import { ResetAccountSection } from "../settings/ResetAccountSection";
import { useAccount } from "../account/AccountProvider";
import { isSuperAdmin } from "../account/profile";

/** Ligne de liste cliquable avec chevron. `badge` signale une zone particulière (ex. administration). */
function NavRow({ to, icon, badge, children }: { to: string; icon: IconName; badge?: string; children: ReactNode }) {
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
        <span className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-900 dark:bg-brand-900 dark:text-brand-100">
              {badge}
            </span>
          ) : null}
          <span aria-hidden="true" className="text-xl text-neutral-600 dark:text-muted">
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Section de l'écran Paramètres : un titre clair, puis un bloc de lignes. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-neutral-600 dark:text-muted">{title}</h2>
      <div className="rounded-card border border-neutral-200 dark:border-white/15">{children}</div>
    </section>
  );
}

/**
 * Paramètres, organisé par intention : préférences, données, compte, administration (super administrateurs),
 * puis la réinitialisation tout en bas, la seule action destructive de l'écran.
 */
export function MorePage() {
  const { t } = useTranslation();
  const account = useAccount();
  const profile = account.status === "signedIn" || account.status === "suspended" ? account.profile : undefined;

  return (
    <section className="flex flex-col gap-8">
      <PageTitle className="text-2xl font-semibold">{t("pages.more.title")}</PageTitle>

      <PreferencesSection />

      <Group title={t("more.groups.myData")}>
        <nav aria-label={t("more.groups.myData")}>
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

      <Group title={t("more.groups.myAccount")}>
        <nav aria-label={t("more.groups.myAccount")}>
          <ul className="divide-y divide-neutral-100 dark:divide-white/10">
            <NavRow to="/plus/account" icon="user">
              {t("account.title")}
            </NavRow>
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

      <InstallCard />

      {isSuperAdmin(profile) ? (
        <Group title={t("admin.group")}>
          <nav aria-label={t("admin.group")}>
            <ul className="divide-y divide-neutral-100 dark:divide-white/10">
              <NavRow to="/plus/admin" icon="crown" badge={t("admin.badge")}>
                {t("admin.title")}
              </NavRow>
            </ul>
          </nav>
        </Group>
      ) : null}

      <Group title={t("resetAccount.group")}>
        <nav aria-label={t("resetAccount.group")}>
          <ul className="divide-y divide-neutral-100 dark:divide-white/10">
            <ResetAccountSection />
          </ul>
        </nav>
      </Group>
    </section>
  );
}
