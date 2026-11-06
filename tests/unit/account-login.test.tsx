import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import "../../src/i18n";
import { AccountProvider } from "../../src/features/account/AccountProvider";
import { AccountGate } from "../../src/features/account/AccountGate";
import { signOutAndClear } from "../../src/features/account/sign-out";
import { AppDatabase } from "../../src/db/database";
import { setSyncTracking } from "../../src/db/sync-tracking";
import { enableSync } from "../../src/features/sync/sync-engine";

const USER = "11111111-1111-4111-8111-111111111111";

function client(session: Session | null) {
  const signOut = vi.fn(async () => ({ error: null }));
  const c = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut,
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    })),
    rpc: vi.fn(async () => ({ data: 0, error: null })),
  };
  return { client: c as unknown as SupabaseClient, signOut };
}

afterEach(() => {
  setSyncTracking(false);
});

describe("compte obligatoire", () => {
  it("sans compte, seul l'écran de connexion s'affiche", async () => {
    const { client: c } = client(null);
    render(
      <AccountProvider client={c}>
        <AccountGate>
          <p>Contenu protégé</p>
        </AccountGate>
      </AccountProvider>,
    );
    expect(await screen.findByRole("heading", { name: /Connexion à votre compte/ })).toBeTruthy();
    expect(screen.queryByText("Contenu protégé")).toBeNull();
  });

  it("sans configuration, l'app reste fermée et le message l'indique", async () => {
    render(
      <AccountProvider client={null}>
        <AccountGate>
          <p>Contenu protégé</p>
        </AccountGate>
      </AccountProvider>,
    );
    expect(await screen.findByText(/service de comptes n'est pas configuré/)).toBeTruthy();
    expect(screen.queryByText("Contenu protégé")).toBeNull();
  });
});

describe("déconnexion", () => {
  it("efface les données de l'appareil et termine la session", async () => {
    const database = new AppDatabase(`login-test-${Math.random().toString(36).slice(2)}`);
    const session = { user: { id: USER, email: "a@b.be" } } as unknown as Session;
    const { client: c, signOut } = client(session);
    // La fusion échoue avec ce faux client (pas de lecture serveur) : l'état « activée » est déjà enregistré.
    await enableSync(c, USER, "merge", database).catch(() => undefined);
    await database.reconciliations.put({
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      walletId: "44444444-4444-4444-8444-444444444444",
      date: "2026-01-02T00:00:00.000Z",
      realBalance: 1,
      computedBalance: 0,
      adjustment: 1,
      memo: "",
    });

    await signOutAndClear(c, database);

    expect(await database.reconciliations.count()).toBe(0);
    expect(await database.syncOutbox.count()).toBe(0);
    expect(signOut).toHaveBeenCalledTimes(1);
    database.close();
    await database.delete();
  });
});
