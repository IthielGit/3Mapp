import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import "../../src/i18n";
import { AccountProvider } from "../../src/features/account/AccountProvider";
import { RequireSuperAdmin } from "../../src/features/admin/RequireSuperAdmin";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Premier chargement du profil en échec (réseau, démarrage à froid), puis succès.
 * Un super administrateur ne doit ni être renvoyé vers Plus, ni voir la console se fermer.
 */
function flakyProfileClient(failures: number) {
  let calls = 0;
  const session = { user: { id: ADMIN_ID, email: "admin@b.be" } } as unknown as Session;
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls += 1;
            if (calls <= failures) return { data: null, error: { message: "fetch failed" } };
            return {
              data: { id: ADMIN_ID, email: "admin@b.be", role: "super_admin", status: "active" },
              error: null,
            };
          },
        }),
      }),
    })),
  };
  return { client: client as unknown as SupabaseClient, calls: () => calls };
}

describe("garde de la console après un chargement de profil incertain", () => {
  it("ne renvoie pas un super administrateur hors de la console après une lecture de profil ratée", async () => {
    const { client } = flakyProfileClient(1);
    render(
      <AccountProvider client={client}>
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
    expect(await screen.findByText("Console", {}, { timeout: 6000 })).toBeTruthy();
    expect(screen.queryByText("Page Plus")).toBeNull();
  });
});
