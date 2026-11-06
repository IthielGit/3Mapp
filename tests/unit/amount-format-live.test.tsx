import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { db } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { setAmountFormat } from "../../src/lib/money";
import { ThemeProvider } from "../../src/lib/theme";

const onboardingInput = {
  language: "fr" as const,
  baseCurrency: "MGA" as const,
  wallet: {
    name: "Compte",
    icon: "🏦",
    color: "#0f766e",
    group: "bank" as const,
    currency: "MGA" as const,
    initialBalance: 1500000,
  },
};

beforeEach(async () => {
  await completeOnboarding(onboardingInput, db);
});

afterEach(async () => {
  setAmountFormat(undefined);
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("Format des montants : mise à jour en direct", () => {
  it("un changement de réglage réaffiche les montants sans remonter l'écran", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/plus/wallets"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    const [before] = await screen.findAllByText(/1\.500\.000/, {}, { timeout: 8000 });
    if (!before) throw new Error("montant absent de l'écran");

    await db.settings.toCollection().modify({ amountFormat: "comma" });

    await waitFor(() => expect(screen.getAllByText(/1,500,000/).length).toBeGreaterThan(0), { timeout: 8000 });
    // Même élément DOM : l'écran n'a pas été remonté (une feuille ouverte ou une saisie serait restée).
    expect(before.isConnected).toBe(true);
    expect(before.textContent).toContain("1,500,000");
  }, 20_000);
});
