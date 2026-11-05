import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAccountConfig } from "../../src/features/account/supabase-client";
import {
  isValidEmail,
  isValidPassword,
  mapAuthError,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
} from "../../src/features/account/account-service";

function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  const auth = {
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
  return { client: { auth } as unknown as SupabaseClient, auth };
}

describe("configuration du compte", () => {
  it("reste non configuré sans variables (app locale)", () => {
    expect(readAccountConfig({})).toBeUndefined();
    expect(readAccountConfig({ VITE_SUPABASE_URL: "https://x.supabase.co" })).toBeUndefined();
  });

  it("refuse une URL invalide", () => {
    expect(readAccountConfig({ VITE_SUPABASE_URL: "pas une url", VITE_SUPABASE_ANON_KEY: "k" })).toBeUndefined();
  });

  it("lit l'URL et la clé anon publique", () => {
    expect(
      readAccountConfig({ VITE_SUPABASE_URL: " https://x.supabase.co ", VITE_SUPABASE_ANON_KEY: "anon" }),
    ).toEqual({ url: "https://x.supabase.co", anonKey: "anon" });
  });
});

describe("validation", () => {
  it("valide les e-mails et exige 8 caractères minimum", () => {
    expect(isValidEmail("a@b.be")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("  ")).toBe(false);
    expect(isValidPassword("1234567")).toBe(false);
    expect(isValidPassword("12345678")).toBe(true);
  });
});

describe("mapAuthError", () => {
  it("traduit les messages connus en codes stables", () => {
    expect(mapAuthError({ message: "Invalid login credentials" } as never)).toBe("invalidCredentials");
    expect(mapAuthError({ message: "Email not confirmed" } as never)).toBe("emailNotConfirmed");
    expect(mapAuthError({ message: "User already registered" } as never)).toBe("alreadyRegistered");
    expect(mapAuthError({ message: "Failed to fetch" } as never)).toBe("network");
    expect(mapAuthError({ message: "surprise" } as never)).toBe("unknown");
    expect(mapAuthError(null)).toBe("unknown");
  });
});

describe("inscription libre", () => {
  it("crée un compte avec la redirection de confirmation, sans validation admin", async () => {
    const { client, auth } = fakeClient();
    const result = await signUpWithEmail(client, " Ana@Exemple.be ", "motdepasse1", "https://app/plus/account");
    expect(result).toEqual({ ok: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "Ana@Exemple.be",
      password: "motdepasse1",
      options: { emailRedirectTo: "https://app/plus/account" },
    });
  });

  it("n'appelle pas le serveur si l'e-mail ou le mot de passe est invalide", async () => {
    const { client, auth } = fakeClient();
    expect(await signUpWithEmail(client, "pas-un-mail", "motdepasse1", "x")).toEqual({
      ok: false,
      code: "invalidEmail",
    });
    expect(await signUpWithEmail(client, "a@b.be", "court", "x")).toEqual({ ok: false, code: "weakPassword" });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("remonte l'erreur serveur sous forme de code", async () => {
    const { client } = fakeClient({
      signUp: vi.fn(async () => ({ data: {}, error: { message: "User already registered" } })),
    });
    expect(await signUpWithEmail(client, "a@b.be", "motdepasse1", "x")).toEqual({
      ok: false,
      code: "alreadyRegistered",
    });
  });
});

describe("connexion et réinitialisation", () => {
  it("connecte par e-mail et mot de passe", async () => {
    const { client, auth } = fakeClient();
    expect(await signInWithEmail(client, "a@b.be", "motdepasse1")).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.be", password: "motdepasse1" });
  });

  it("envoie la réinitialisation seulement pour une adresse valide", async () => {
    const { client, auth } = fakeClient();
    expect(await sendPasswordReset(client, "x", "r")).toEqual({ ok: false, code: "invalidEmail" });
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(await sendPasswordReset(client, "a@b.be", "r")).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.be", { redirectTo: "r" });
  });
});
