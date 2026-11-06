import type { User } from "@supabase/supabase-js";

/**
 * Identité du dernier compte connecté, gardée sur cet appareil.
 * Sert uniquement quand le serveur est injoignable et que la session stockée ne peut pas être renouvelée :
 * sans cela, l'app retomberait sur l'écran de connexion alors que les données locales sont là.
 */
export type CachedUser = Pick<User, "id" | "email" | "user_metadata">;

const CACHE_KEY = "fundora.account.user";

export function readCachedUser(): CachedUser | undefined {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const record = value as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id === "") return undefined;
    const email = typeof record.email === "string" ? record.email : undefined;
    const meta = typeof record.user_metadata === "object" && record.user_metadata !== null ? record.user_metadata : {};
    return { id: record.id, email, user_metadata: meta as CachedUser["user_metadata"] };
  } catch {
    // Stockage indisponible ou valeur corrompue : pas d'identité hors ligne.
    return undefined;
  }
}

export function writeCachedUser(user: CachedUser): void {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ id: user.id, email: user.email, user_metadata: user.user_metadata }),
    );
  } catch {
    // Stockage bloqué : l'app ne saura pas s'ouvrir hors ligne après la fermeture, c'est tout.
  }
}

export function clearCachedUser(): void {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Rien à nettoyer si le stockage est indisponible.
  }
}
