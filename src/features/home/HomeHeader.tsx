import { useTranslation } from "react-i18next";
import { BrandMark } from "../../components/BrandMark";
import { AccountMenu } from "../../components/AccountMenu";
import { SyncButton } from "../sync/SyncButton";
import { SyncStatusLine } from "../sync/SyncStatusLine";
import { useAccountIdentity } from "../account/account-identity";

/**
 * En-tête de l'accueil : « Bienvenue » et le nom du compte à gauche ; à droite, l'état des données
 * (discret), puis la synchro et le compte, sur une même ligne.
 */
export function HomeHeader() {
  const { t } = useTranslation();
  const identity = useAccountIdentity();
  return (
    <header className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between gap-3 bg-canvas px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-page">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark size={44} className="shrink-0 rounded-xl shadow-sm" />
        <div className="flex min-w-0 flex-col">
          <span className="text-2xl font-semibold tracking-tight text-ink dark:text-fg">{t("home.hello")}</span>
          {identity.name ? (
            <span className="truncate text-sm text-neutral-600 dark:text-muted">{identity.name}</span>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 max-w-[55%] items-center gap-2">
        <SyncStatusLine inline />
        <div className="flex shrink-0 items-center gap-2">
          <SyncButton />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
