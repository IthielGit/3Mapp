import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import type { HomeData } from "./useHomeData";

/**
 * Saisie en retard : un ou plusieurs portefeuilles sans mouvement ni réconciliation depuis trop longtemps.
 * Le lien mène au plus en retard (`stale` est trié du plus ancien au plus récent) ; les autres sont comptés.
 */
export function StaleWalletBanner({ stale }: { stale: HomeData["stale"] }) {
  const { t } = useTranslation();
  const first = stale[0];
  if (!first) return null;
  const others = stale.length - 1;
  return (
    <Link
      to={`/plus/wallets/${first.wallet.id}/reconcile`}
      className="pressable flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink dark:border-amber-700 dark:bg-raised dark:text-fg"
    >
      <span>
        {others > 0
          ? t("home.layout.staleMany", { name: first.wallet.name, days: first.daysSince, count: others })
          : t("home.staleWallet", { name: first.wallet.name, days: first.daysSince })}
      </span>
      <span className="shrink-0 font-semibold underline">{t("home.staleAction")}</span>
    </Link>
  );
}

/** Carte d'alerte plate : bord Pierre, icône de tête cyan (décor), sans bande latérale. */
const ALERT_CLASS =
  "flex min-h-[44px] items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-sm text-ink shadow-sm dark:border-white/15 dark:bg-card dark:text-fg";
const ALERT_ICON_CLASS = "h-5 w-5 shrink-0 text-brand-600 dark:text-brand-dark";

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
          className={ALERT_CLASS}
        >
          <Icon name="shield" className={ALERT_ICON_CLASS} />
          <span>{t("home.backupReminder")}</span>
        </Link>
      ) : null}
      {pendingCount > 0 ? (
        <Link
          to="/plus/recurring"
          className={ALERT_CLASS}
        >
          <Icon name="repeat" className={ALERT_ICON_CLASS} />
          <span>{t("home.pendingBanner", { count: pendingCount })}</span>
        </Link>
      ) : null}
    </>
  );
}
