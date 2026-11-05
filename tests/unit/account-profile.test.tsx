import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import "../../src/i18n";
import {
  clearCachedStatus,
  fetchProfile,
  isSuperAdmin,
  readCachedStatus,
  resolveStatus,
  writeCachedStatus,
  type AccountProfile,
} from "../../src/features/account/profile";
import { AccountProvider } from "../../src/features/account/AccountProvider";
import { AccountGate } from "../../src/features/account/AccountGate";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function profile(overrides: Partial<AccountProfile> = {}): AccountProfile {
  return { id: USER_ID, email: "ana@exemple.be", role: "user", status: "active", ...overrides };
}

describe("statut effectif", () => {
  it("le profil fait foi quand il est lu", () => {
    expect(resolveStatus(profile({ status: "suspended" }), "active")).toBe("suspended");
    expect(resolveStatus(profile({ status: "active" }), "suspended")).toBe("active");
  });

  it("hors ligne, le dernier statut connu s'applique (un compte suspendu reste bloqué)", () => {
    expect(resolveStatus(undefined, "suspended")).toBe("suspended");
    expect(resolveStatus(undefined, undefined)).toBe("active");
  });

  it("identifie le super administrateur", () => {
    expect(isSuperAdmin(profile({ role: "super_admin" }))).toBe(true);
    expect(isSuperAdmin(profile())).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe("cache du statut sur l'appareil", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("mémorise, relit et oublie le statut par compte", () => {
    expect(readCachedStatus(USER_ID)).toBeUndefined();
    writeCachedStatus(USER_ID, "suspended");
    expect(readCachedStatus(USER_ID)).toBe("suspended");
    clearCachedStatus(USER_ID);
    expect(readCachedStatus(USER_ID)).toBeUndefined();
  });

  it("ignore une valeur corrompue", () => {
    window.localStorage.setItem(`fundora.account.status:${USER_ID}`, "n'importe quoi");
    expect(readCachedStatus(USER_ID)).toBeUndefined();
  });
});

/** Faux client Supabase : seules les méthodes utilisées par la phase B sont simulées. */
function fakeClient(options: { profileRow?: unknown; session?: Session | null; profileError?: boolean }) {
  const session = options.session === undefined ? ({ user: { id: USER_ID, email: "ana@exemple.be" } } as Session) : options.session;
  const maybeSingle = vi.fn(async () =>
    options.profileError ? { data: null, error: { message: "network" } } : { data: options.profileRow ?? null, error: null },
  );
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    })),
  };
  return { client: client as unknown as SupabaseClient, maybeSingle };
}

describe("lecture du profil", () => {
  it("renvoie le profil valide et ignore une réponse mal formée", async () => {
    const good = fakeClient({ profileRow: { id: USER_ID, email: "a@b.be", role: "user", status: "active" } });
    expect(await fetchProfile(good.client, USER_ID)).toEqual({
      id: USER_ID,
      email: "a@b.be",
      role: "user",
      status: "active",
    });
    const bad = fakeClient({ profileRow: { id: USER_ID, email: "a@b.be", role: "root", status: "active" } });
    expect(await fetchProfile(bad.client, USER_ID)).toBeUndefined();
  });
});

describe("garde de compte suspendu", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("bloque l'application quand le profil est suspendu", async () => {
    const { client } = fakeClient({
      profileRow: { id: USER_ID, email: "ana@exemple.be", role: "user", status: "suspended" },
    });
    render(
      <AccountProvider client={client}>
        <AccountGate>
          <p>Contenu de l'application</p>
        </AccountGate>
      </AccountProvider>,
    );
    expect(await screen.findByText("Compte suspendu")).toBeTruthy();
    expect(screen.queryByText("Contenu de l'application")).toBeNull();
  });

  it("laisse passer un compte actif", async () => {
    const { client } = fakeClient({
      profileRow: { id: USER_ID, email: "ana@exemple.be", role: "user", status: "active" },
    });
    render(
      <AccountProvider client={client}>
        <AccountGate>
          <p>Contenu de l'application</p>
        </AccountGate>
      </AccountProvider>,
    );
    expect(await screen.findByText("Contenu de l'application")).toBeTruthy();
  });

  it("reste bloqué hors ligne si le statut suspendu a été mémorisé", async () => {
    writeCachedStatus(USER_ID, "suspended");
    const { client } = fakeClient({ profileError: true });
    render(
      <AccountProvider client={client}>
        <AccountGate>
          <p>Contenu de l'application</p>
        </AccountGate>
      </AccountProvider>,
    );
    expect(await screen.findByText("Compte suspendu")).toBeTruthy();
  });
});
