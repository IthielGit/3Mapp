import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";

/** Redirige vers l'onboarding tant qu'aucun réglage n'existe (premier lancement). */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const settingsCount = useLiveQuery(() => db.settings.count(), []);
  if (settingsCount === undefined) return null;
  if (settingsCount === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
