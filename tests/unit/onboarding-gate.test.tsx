import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../src/i18n";
import type { AccountState } from "../../src/features/account/AccountProvider";
import { db } from "../../src/db/database";
import { SYNC_STATE_ID } from "../../src/db/sync-tracking";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { RequireOnboarding } from "../../src/components/RequireOnboarding";

const state = vi.hoisted(() => ({ account: { status: "unconfigured" } as unknown }));

vi.mock("../../src/features/account/AccountProvider", () => ({
  useAccount: () => state.account as AccountState,
}));

const SIGNED_IN = {
  status: "signedIn",
  client: {},
  session: { user: { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com", user_metadata: {} } },
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/onboarding" element={<p>Écran de configuration</p>} />
        <Route
          path="*"
          element={
            <RequireOnboarding>
              <p>Application</p>
            </RequireOnboarding>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

afterEach(() => {
  state.account = { status: "unconfigured" };
});

describe("premier lancement et synchronisation", () => {
  it("compte connecté jamais synchronisé : pas d'onboarding, proposition de réessayer", async () => {
    state.account = SIGNED_IN;
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Synchronisation nécessaire" })).toBeInTheDocument();
    expect(screen.queryByText("Écran de configuration")).toBeNull();
    expect(screen.queryByText("Application")).toBeNull();
  });

  it("compte connecté et synchronisé sans réglages : onboarding", async () => {
    state.account = SIGNED_IN;
    await db.syncState.put({ id: SYNC_STATE_ID, enabled: true, lastSyncAt: "2026-11-06T10:00:00.000Z" });
    renderAt("/");
    expect(await screen.findByText("Écran de configuration")).toBeInTheDocument();
  });

  it("réglages présents : l'application s'affiche", async () => {
    await completeOnboarding(
      {
        language: "fr",
        baseCurrency: "MGA",
        wallet: { name: "Compte", icon: "🏦", color: "#0f766e", group: "bank", currency: "MGA", initialBalance: 0 },
      },
      db,
    );
    state.account = SIGNED_IN;
    renderAt("/");
    expect(await screen.findByText("Application")).toBeInTheDocument();
  });
});
