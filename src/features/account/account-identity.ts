import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useAccount, type AccountState } from "./AccountProvider";
import type { CachedUser } from "./offline-user";

/**
 * Nom et photo du compte, lus dans les métadonnées de la session.
 * Une connexion Google les fournit (full_name, avatar_url) : aucune requête supplémentaire vers Google.
 * Un compte e-mail/mot de passe n'a pas de photo : l'appelant retombe sur l'initiale.
 */
export interface AccountIdentity {
  name: string;
  avatarUrl?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** Ordre de repli du nom : nom complet Google, nom, puis partie locale de l'e-mail. */
export function accountIdentity(user: Pick<User, "email" | "user_metadata"> | undefined): AccountIdentity {
  const meta: Record<string, unknown> = user?.user_metadata ?? {};
  const name = text(meta.full_name) ?? text(meta.name) ?? text(user?.email?.split("@")[0]) ?? "";
  // Seules les adresses https sont acceptées (pas de contenu inattendu dans une balise img).
  const avatar = text(meta.avatar_url) ?? text(meta.picture);
  const avatarUrl = avatar?.startsWith("https://") ? avatar : undefined;
  return { name, avatarUrl };
}

/**
 * Client et utilisateur du compte affiché : connecté, suspendu, ou hors ligne (identité mémorisée).
 * `undefined` sans compte chargé.
 */
export function currentAccount(account: AccountState): { client: SupabaseClient; user: CachedUser } | undefined {
  if (account.status === "signedIn" || account.status === "suspended") {
    return { client: account.client, user: account.session.user };
  }
  if (account.status === "offline") return { client: account.client, user: account.user };
  return undefined;
}

/** Identité du compte affiché ; vide hors session. */
export function useAccountIdentity(): AccountIdentity {
  const current = currentAccount(useAccount());
  return current ? accountIdentity(current.user) : { name: "" };
}
