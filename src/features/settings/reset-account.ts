import type { SupabaseClient } from "@supabase/supabase-js";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { isReadOnly } from "../../db/sync-tracking";
import { classify, disableSync } from "../sync/sync-engine";

/** Compte connecté dont les données synchronisées doivent aussi être effacées sur le serveur. */
export interface RemoteWipe {
  client: SupabaseClient;
  userId: string;
}

/**
 * Supprime toutes les données de cet appareil (toutes les tables, pièces jointes comprises).
 * Une seule transaction : en cas d'erreur, rien n'est supprimé.
 * Avec `remote` : les lignes sync_records du compte sont supprimées d'abord, sinon la synchro
 * les retéléchargerait au prochain démarrage. Si l'effacement serveur échoue, rien n'est supprimé localement.
 * Après réinitialisation, l'écran de premier lancement s'affiche à nouveau.
 */
export async function resetAccount(database: AppDatabase = defaultDb, remote?: RemoteWipe): Promise<void> {
  if (remote) {
    // Consultation d'un autre compte : les données locales ne sont pas celles de ce compte, on n'efface rien sur le serveur.
    if (isReadOnly()) throw classify({ message: "read-only" });
    // La synchro est arrêtée avant l'effacement, pour qu'aucun envoi en attente ne réécrive les données.
    await disableSync(database);
    const { error } = await remote.client.from("sync_records").delete().eq("user_id", remote.userId);
    if (error) throw classify(error);
  }
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) await table.clear();
  });
}
