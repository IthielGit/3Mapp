import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buttonSecondary } from "../../components/FormControls";
import { useAccount } from "../account/AccountProvider";
import { isSuperAdmin } from "../account/profile";

/**
 * Garde de la console : seul le super administrateur y accède. Les autres sont renvoyés vers Plus.
 * La vraie protection reste côté base (fonctions require_super_admin) ; ceci évite seulement l'affichage.
 */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const account = useAccount();
  if (account.status !== "signedIn") return null;
  // Profil introuvable (réseau) : on ne sait pas si c'est un super administrateur. Pas de redirection : on demande de réessayer.
  if (!account.profile) {
    return (
      <div role="alert" className="flex flex-col gap-3 p-2">
        <p className="text-red-700 dark:text-red-400">{t("admin.profileUnavailable")}</p>
        <button type="button" className={buttonSecondary} onClick={() => window.location.reload()}>
          {t("admin.retry")}
        </button>
      </div>
    );
  }
  if (!isSuperAdmin(account.profile)) return <Navigate to="/plus" replace />;
  return <>{children}</>;
}
