import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { clearCachedUser } from "./offline-user";

/** Erreurs métier du service de comptes ; l'interface traduit chaque code (i18n, jamais de texte en dur). */
export type AccountErrorCode =
  | "invalidEmail"
  | "weakPassword"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "alreadyRegistered"
  | "network"
  | "unknown";

export type AccountResult = { ok: true } | { ok: false; code: AccountErrorCode };

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/** Traduit une erreur Supabase en code métier stable (les messages du serveur ne sont pas affichés). */
export function mapAuthError(error: AuthError | Error | null | undefined): AccountErrorCode {
  if (!error) return "unknown";
  const message = error.message.toLowerCase();
  const status = "status" in error ? error.status : undefined;
  if (message.includes("invalid login credentials")) return "invalidCredentials";
  if (message.includes("email not confirmed")) return "emailNotConfirmed";
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "alreadyRegistered";
  }
  if (message.includes("password") && (message.includes("least") || message.includes("weak"))) {
    return "weakPassword";
  }
  if (message.includes("fetch") || message.includes("network") || status === 0) return "network";
  return "unknown";
}

/** Inscription libre (sans validation de l'admin) : crée un compte « user ». */
export async function signUpWithEmail(
  client: SupabaseClient,
  email: string,
  password: string,
  redirectTo: string,
): Promise<AccountResult> {
  if (!isValidEmail(email)) return { ok: false, code: "invalidEmail" };
  if (!isValidPassword(password)) return { ok: false, code: "weakPassword" };
  const { error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (!error) return { ok: true };
  // Adresse déjà utilisée : même réponse qu'une inscription réussie, pour ne pas révéler qu'un compte existe.
  if (mapAuthError(error) === "alreadyRegistered") return { ok: true };
  return { ok: false, code: mapAuthError(error) };
}

export async function signInWithEmail(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AccountResult> {
  if (!isValidEmail(email)) return { ok: false, code: "invalidEmail" };
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, code: mapAuthError(error) } : { ok: true };
}

/**
 * Lance la connexion Google (redirection). Le résultat arrive au retour sur l'app.
 * `prompt: select_account` force le choix du compte : sans lui, Google réutilise le dernier compte vu sur le téléphone.
 */
export async function signInWithGoogle(client: SupabaseClient, redirectTo: string): Promise<AccountResult> {
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  return error ? { ok: false, code: mapAuthError(error) } : { ok: true };
}

export async function sendPasswordReset(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<AccountResult> {
  if (!isValidEmail(email)) return { ok: false, code: "invalidEmail" };
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  return error ? { ok: false, code: mapAuthError(error) } : { ok: true };
}

export async function signOutAccount(client: SupabaseClient): Promise<AccountResult> {
  // L'identité mémorisée pour le mode hors ligne ne doit pas survivre à la déconnexion.
  clearCachedUser();
  const { error } = await client.auth.signOut();
  return error ? { ok: false, code: mapAuthError(error) } : { ok: true };
}
