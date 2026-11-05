import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Configuration du service de comptes (SPEC §5.14 / plan « comptes »).
 * Les valeurs viennent de variables publiques de build (`.env.local`, non versionné).
 * Seule la clé « anon » publique est autorisée côté client : jamais de clé service.
 */
export interface AccountConfig {
  url: string;
  anonKey: string;
}

/** Lit la configuration ; `undefined` si le service n'est pas configuré (app 100 % locale). */
export function readAccountConfig(env: Record<string, unknown> = import.meta.env): AccountConfig | undefined {
  const url = typeof env.VITE_SUPABASE_URL === "string" ? env.VITE_SUPABASE_URL.trim() : "";
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === "string" ? env.VITE_SUPABASE_ANON_KEY.trim() : "";
  if (!url || !anonKey) return undefined;
  try {
    new URL(url);
  } catch {
    return undefined;
  }
  return { url, anonKey };
}

let cached: { client: SupabaseClient } | null | undefined;

/** Client Supabase partagé, ou `null` si non configuré. Aucune requête n'est faite à la création. */
export function getSupabase(): SupabaseClient | null {
  if (cached === undefined) {
    const config = readAccountConfig();
    cached = config
      ? {
          client: createClient(config.url, config.anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          }),
        }
      : null;
  }
  return cached?.client ?? null;
}
