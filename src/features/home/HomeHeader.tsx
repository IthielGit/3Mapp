import { useTranslation } from "react-i18next";
import { BrandMark } from "../../components/BrandMark";
import { AccountMenu } from "../../components/AccountMenu";
import { SyncButton } from "../sync/SyncButton";
import { SyncStatusLine } from "../sync/SyncStatusLine";
import { useAccountIdentity } from "../account/account-identity";

/**
 * En-tête de l'accueil : « Bienvenue », le nom du compte, la synchro et le menu du compte,
 * puis la ligne d'état des données (hors ligne, en attente d'envoi, à jour, erreur).
 */
export function HomeHeader() {
  const { t } = useTranslation();
  const identity = useAccountIdentity();
  return (
    <header className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-1 bg-canvas px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size={44} className="shrink-0 rounded-xl shadow-sm" />
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tracking-tight text-ink dark:text-fg">{t("home.hello")}</span>
            {identity.name ? (
              <span className="truncate text-sm text-neutral-600 dark:text-muted">{identity.name}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <AccountMenu />
        </div>
      </div>
      <SyncStatusLine />
    </header>
  );
}
