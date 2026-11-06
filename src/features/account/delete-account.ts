import type { SupabaseClient } from "@supabase/supabase-js";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { resetAccount } from "../settings/reset-account";
import { disableSync } from "../sync/sync-engine";
import { signOutAccount, type AccountResult } from "./account-service";
import { leaveConsultLocally } from "../admin/consult";

/**
 * Supprime définitivement le compte connecté (RGPD) : ses données sur le serveur, puis celles de cet appareil.
 * L'ordre protège les données : si le serveur ne répond pas, rien n'est effacé localement.
 * Un autre appareil connecté au même compte perdra l'accès à la synchro.
 */
export async function deleteOwnAccount(
  client: SupabaseClient,
  database: AppDatabase = defaultDb,
): Promise<AccountResult> {
  await leaveConsultLocally(client);
  const { error } = await client.rpc("delete_own_account");
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    return { ok: false, code: message.includes("fetch") || message.includes("network") ? "network" : "unknown" };
  }
  await disableSync(database);
  await resetAccount(database);
  await signOutAccount(client).catch(() => undefined);
  return { ok: true };
}
