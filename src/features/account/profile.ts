import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** Rôles et statuts du plan « comptes » (migration 0001). Un utilisateur ne peut pas les modifier lui-même. */
export type AccountRole = "user" | "super_admin";
export type AccountStatus = "active" | "suspended";

export interface AccountProfile {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
}

const profileSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(["user", "super_admin"]),
  status: z.enum(["active", "suspended"]),
});

/** Délai maximal de lecture du profil : au-delà, on continue avec le dernier statut connu. */
export const PROFILE_TIMEOUT_MS = 8000;

/** Nouvelles tentatives après un échec de lecture (démarrage à froid, réseau instable) avant d'abandonner. */
export const PROFILE_RETRIES = 2;
export const PROFILE_RETRY_MS = 2000;

/** Lit le profil du compte connecté. `undefined` en cas d'erreur réseau ou de profil absent. */
export async function fetchProfile(client: SupabaseClient, userId: string): Promise<AccountProfile | undefined> {
  const { data, error } = await client
    .from("profiles")
    .select("id,email,role,status")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return undefined;
  const parsed = profileSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

const CACHE_PREFIX = "fundora.account.status:";

/**
 * Dernier statut connu, par compte, sur cet appareil. Sert quand le serveur est injoignable :
 * un compte suspendu reste bloqué hors ligne. Lecture et écriture protégées (navigation privée, stockage bloqué).
 */
export function readCachedStatus(userId: string): AccountStatus | undefined {
  try {
    const value = window.localStorage.getItem(CACHE_PREFIX + userId);
    return value === "active" || value === "suspended" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedStatus(userId: string, status: AccountStatus): void {
  try {
    window.localStorage.setItem(CACHE_PREFIX + userId, status);
  } catch {
    // Stockage indisponible : le blocage hors ligne ne sera pas mémorisé, c'est tout.
  }
}

export function clearCachedStatus(userId: string): void {
  try {
    window.localStorage.removeItem(CACHE_PREFIX + userId);
  } catch {
    // Rien à nettoyer si le stockage est indisponible.
  }
}

/** Statut effectif : le profil fait foi ; à défaut (hors ligne), le dernier statut connu. */
export function resolveStatus(profile: AccountProfile | undefined, cached: AccountStatus | undefined): AccountStatus {
  if (profile) return profile.status;
  return cached ?? "active";
}

export function isSuperAdmin(profile: AccountProfile | undefined): boolean {
  return profile?.role === "super_admin";
}
