import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import "../../src/i18n";
import { db } from "../../src/db/database";
import { AccountProvider } from "../../src/features/account/AccountProvider";
import { SyncBootstrap } from "../../src/features/sync/SyncBootstrap";

const CURRENT_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "11111111-1111-4111-8111-111111111111";

function signedInClient(): SupabaseClient {
  const session = { user: { id: CURRENT_USER, email: "b@b.be" } } as unknown as Session;
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: CURRENT_USER, email: "b@b.be", role: "user", status: "active" },
            error: null,
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient;
}

beforeEach(async () => {
  // Données laissées par un autre compte sur cet appareil (session expirée sans déconnexion).
  await db.syncState.put({ id: "state", enabled: true, userId: OTHER_USER });
  await db.reconciliations.put({
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
});

afterEach(async () => {
  await db.syncState.clear();
  await db.reconciliations.clear();
  await db.syncOutbox.clear();
});

describe("données d'un autre compte sur l'appareil", () => {
  it("bloque l'effacement et la déconnexion tant qu'aucune sauvegarde n'est téléchargée", async () => {
    render(
      <AccountProvider client={signedInClient()}>
        <SyncBootstrap>
          <p>Application</p>
        </SyncBootstrap>
      </AccountProvider>,
    );

    const replace = await screen.findByRole("button", { name: "Utiliser seulement ce compte" });
    expect((replace as HTMLButtonElement).disabled).toBe(true);
    const signOut = screen.getByRole("button", { name: "Se déconnecter" });
    expect((signOut as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Application")).toBeNull();
    expect(screen.getByRole("button", { name: "Télécharger une sauvegarde" })).toBeTruthy();
  });
});
