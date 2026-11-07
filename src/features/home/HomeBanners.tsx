import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { HomeData } from "./useHomeData";

/** Saisie en retard : un portefeuille sans mouvement ni réconciliation depuis trop longtemps. */
export function StaleWalletBanner({ stale }: { stale: HomeData["stale"] }) {
  const { t } = useTranslation();
  const first = stale[0];
  if (!first) return null;
  return (
    <Link
      to={`/plus/wallets/${first.wallet.id}/reconcile`}
      className="pressable flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink dark:border-amber-700 dark:bg-raised dark:text-fg"
    >
      <span>{t("home.staleWallet", { name: first.wallet.name, days: first.daysSince })}</span>
      <span className="shrink-0 font-semibold underline">{t("home.staleAction")}</span>
    </Link>
  );
}

/** Alertes : fines, sous la carte, sans couleur d'avertissement. */
export function HomeAlerts({
  backupState,
  pendingCount,
}: {
  backupState: HomeData["backupState"];
  pendingCount: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      {backupState !== "none" ? (
        <Link
          to="/plus/backup"
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 border-l-[3px] border-l-brand-600 bg-white p-3 text-sm text-ink shadow-sm dark:border-white/15 dark:bg-card dark:text-fg"
        >
          {t("home.backupReminder")}
        </Link>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          to="/plus/recurring"
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 border-l-[3px] border-l-brand-600 bg-white p-3 text-sm text-ink shadow-sm dark:border-white/15 dark:bg-card dark:text-fg"
        >
          {t("home.pendingBanner", { count: pendingCount })}
        </Link>
      ) : null}
    </>
  );
}
