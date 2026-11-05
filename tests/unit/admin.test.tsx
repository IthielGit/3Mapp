import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import "../../src/i18n";
import {
  AdminError,
  deleteAccount,
  listAccounts,
  setAccountStatus,
} from "../../src/features/admin/admin-service";
import { summarizeRecord } from "../../src/features/admin/format";
import { RequireSuperAdmin } from "../../src/features/admin/RequireSuperAdmin";
import { AccountProvider } from "../../src/features/account/AccountProvider";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function rpcClient(response: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async () => ({ data: response.data ?? null, error: response.error ?? null }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("service d'administration", () => {
  it("appelle la fonction serveur et valide les comptes reçus", async () => {
    const { client, rpc } = rpcClient({
      data: [
        {
          id: USER_ID,
          email: "a@b.be",
          role: "user",
          status: "active",
          created_at: "2026-01-01T00:00:00.000Z",
          last_sync_at: null,
          record_count: "12",
        },
      ],
    });
    const accounts = await listAccounts(client);
    expect(rpc).toHaveBeenCalledWith("admin_list_accounts", {});
    expect(accounts[0]?.record_count).toBe(12);
    expect(accounts[0]?.last_sync_at).toBeNull();
  });

  it("classe un refus serveur comme interdit", async () => {
    const { client } = rpcClient({ error: { code: "42501", message: "forbidden" } });
    await expect(listAccounts(client)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuse une réponse mal formée", async () => {
    const { client } = rpcClient({ data: [{ id: "pas-un-uuid" }] });
    await expect(listAccounts(client)).rejects.toBeInstanceOf(AdminError);
    await expect(listAccounts(client)).rejects.toMatchObject({ code: "invalid" });
  });

  it("transmet suspension et suppression avec l'identifiant du compte", async () => {
    const { client, rpc } = rpcClient({});
    await setAccountStatus(client, USER_ID, "suspended");
    expect(rpc).toHaveBeenLastCalledWith("admin_set_status", { p_user: USER_ID, p_status: "suspended" });
    await deleteAccount(client, USER_ID);
    expect(rpc).toHaveBeenLastCalledWith("admin_delete_account", { p_user: USER_ID });
  });
});

describe("résumé des enregistrements", () => {
  it("affiche les champs utiles dans l'ordre", () => {
    expect(summarizeRecord({ name: "Courses", amount: 2500, date: "2026-01-02" })).toBe(
      "name: Courses · amount: 2500 · date: 2026-01-02",
    );
  });

  it("reste lisible sans champ connu et sans donnée", () => {
    expect(summarizeRecord(null)).toBe("");
    expect(summarizeRecord({ foo: "bar" })).toBe('{"foo":"bar"}');
  });
});

/** Faux client : un compte connecté dont le profil a le rôle donné. */
function signedInWithRole(role: "user" | "super_admin") {
  const session = { user: { id: ADMIN_ID, email: "admin@b.be" } } as unknown as Session;
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: ADMIN_ID, email: "admin@b.be", role, status: "active" },
            error: null,
          }),
        }),
      }),
    })),
  };
  return client as unknown as SupabaseClient;
}

describe("garde de la console", () => {
  it("renvoie un utilisateur ordinaire hors de la console", async () => {
    render(
      <AccountProvider client={signedInWithRole("user")}>
        <MemoryRouter initialEntries={["/plus/admin"]}>
          <Routes>
            <Route path="/plus" element={<p>Page Plus</p>} />
            <Route
              path="/plus/admin"
              element={
                <RequireSuperAdmin>
                  <p>Console</p>
                </RequireSuperAdmin>
              }
            />
          </Routes>
        </MemoryRouter>
      </AccountProvider>,
    );
    expect(await screen.findByText("Page Plus")).toBeTruthy();
    expect(screen.queryByText("Console")).toBeNull();
  });

  it("laisse passer le super administrateur", async () => {
    render(
      <AccountProvider client={signedInWithRole("super_admin")}>
        <MemoryRouter initialEntries={["/plus/admin"]}>
          <Routes>
            <Route
              path="/plus/admin"
              element={
                <RequireSuperAdmin>
                  <p>Console</p>
                </RequireSuperAdmin>
              }
            />
          </Routes>
        </MemoryRouter>
      </AccountProvider>,
    );
    expect(await screen.findByText("Console")).toBeTruthy();
  });
});
