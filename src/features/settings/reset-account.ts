import { db as defaultDb, type AppDatabase } from "../../db/database";

/**
 * Supprime toutes les données de cet appareil (toutes les tables, pièces jointes comprises).
 * Une seule transaction : en cas d'erreur, rien n'est supprimé.
 * Après réinitialisation, l'écran de premier lancement s'affiche à nouveau.
 */
export async function resetAccount(database: AppDatabase = defaultDb): Promise<void> {
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) await table.clear();
  });
}
