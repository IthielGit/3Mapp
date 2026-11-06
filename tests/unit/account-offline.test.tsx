import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import "../../src/i18n";
import { AccountProvider } from "../../src/features/account/AccountProvider";
import { AccountGate } from "../../src/features/account/AccountGate";
import { readCachedUser, writeCachedUser } from "../../src/features/account/offline-user";
import { writeCachedStatus } from "../../src/features/account/profile";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CACHED = { id: USER_ID, email: "ana@exemple.be", user_metadata: {} };

/**
 * Faux client : la session stockée ne peut pas être renouvelée (refresh impossible hors ligne).
 * `error` décrit la raison renvoyée par getSession.
 */
function fakeClient(error: unknown) {
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
  return client as unknown as SupabaseClient;
}

function renderApp(client: SupabaseClient) {
  return render(
    <AccountProvider client={client}>
      <AccountGate>
        <p>Contenu de l'application</p>
      </AccountGate>
    </AccountProvider>,
  );
}

describe("hors ligne : la session ne doit pas déconnecter l'utilisateur", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("reste ouvert avec l'identité mémorisée quand le renouvellement échoue faute de réseau", async () => {
    writeCachedUser(CACHED);
    renderApp(fakeClient(new AuthRetryableFetchError("Failed to fetch", 0)));
    expect(await screen.findByText("Contenu de l'application")).toBeTruthy();
    expect(readCachedUser()?.id).toBe(USER_ID);
  });

  it("reste bloqué hors ligne si le statut suspendu a été vu sur cet appareil", async () => {
    writeCachedUser(CACHED);
    writeCachedStatus(USER_ID, "suspended");
    renderApp(fakeClient(new AuthRetryableFetchError("Failed to fetch", 0)));
    expect(await screen.findByText("Compte suspendu")).toBeTruthy();
    expect(screen.queryByText("Contenu de l'application")).toBeNull();
  });

  it("sans identité mémorisée, l'écran de connexion reste la seule issue", async () => {
    renderApp(fakeClient(new AuthRetryableFetchError("Failed to fetch", 0)));
    // Pas de compte à ouvrir hors ligne : le contenu n'est pas affiché.
    await vi.waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByText("Contenu de l'application")).toBeNull();
  });

  it("une déconnexion réelle (sans erreur réseau) efface l'identité mémorisée", async () => {
    writeCachedUser(CACHED);
    renderApp(fakeClient(null));
    await vi.waitFor(() => expect(readCachedUser()).toBeUndefined());
    expect(screen.queryByText("Contenu de l'application")).toBeNull();
  });
});
