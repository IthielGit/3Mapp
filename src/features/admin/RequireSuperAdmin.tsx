import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAccount } from "../account/AccountProvider";
import { isSuperAdmin } from "../account/profile";

/**
 * Garde de la console : seul le super administrateur y accède. Les autres sont renvoyés vers Plus.
 * La vraie protection reste côté base (fonctions require_super_admin) ; ceci évite seulement l'affichage.
 */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const account = useAccount();
  if (account.status !== "signedIn") return null;
  if (!isSuperAdmin(account.profile)) return <Navigate to="/plus" replace />;
  return <>{children}</>;
}
