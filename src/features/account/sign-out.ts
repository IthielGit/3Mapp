import type { SupabaseClient } from "@supabase/supabase-js";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { disableSync, runSync } from "../sync/sync-engine";
import { resetAccount } from "../settings/reset-account";
import { signOutAccount, type AccountResult } from "./account-service";
import { leaveConsultLocally } from "../admin/consult";

/**
 * Déconnexion (compte obligatoire) : dernier envoi si possible, puis effacement des données de cet appareil,
 * puis fin de session. Un autre compte qui se connecte ici repart donc de la base de son propre compte.
 * Les modifications non envoyées (hors ligne) sont perdues : l'interface le demande avant.
 */
export async function signOutAndClear(
  client: SupabaseClient,
  database: AppDatabase = defaultDb,
): Promise<AccountResult> {
  // Consultation en cours : on la ferme avant le nettoyage (sinon la lecture seule refuserait l'effacement).
  await leaveConsultLocally(client);
  try {
    await runSync(client, database);
  } catch {
    // Hors ligne ou compte suspendu : on continue, l'utilisateur a été prévenu.
  }
  await disableSync(database);
  await resetAccount(database);
  return signOutAccount(client);
}
