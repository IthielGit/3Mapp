import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import App from "../../src/App";

// Les pages sont chargées à la demande : on les compile une fois avant les tests, pour que la
// mesure ne porte que sur la navigation (et non sur la transformation du code sous charge).
beforeAll(async () => {
  await Promise.all([
    import("../../src/features/home/HomePage"),
    import("../../src/features/budgets/BudgetsPage"),
    import("../../src/features/more/MorePage"),
  ]);
}, 60_000);
import { db } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { ThemeProvider } from "../../src/lib/theme";

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const onboardingInput = {
  language: "fr" as const,
  baseCurrency: "MGA" as const,
  wallet: {
    name: "Compte",
    icon: "🏦",
    color: "#0f766e",
    group: "bank" as const,
    currency: "MGA" as const,
    initialBalance: 0,
  },
};

beforeEach(async () => {
  await completeOnboarding(onboardingInput, db);
});

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("navigation mobile", () => {
  it("affiche les 5 onglets de la barre basse", async () => {
    renderAt("/");
    const nav = await screen.findByRole("navigation", { name: "Accueil" }, { timeout: 8000 });
    for (const label of ["Accueil", "Transactions", "Stats", "Budgets", "Plus"]) {
      expect(nav).toHaveTextContent(label);
    }
    // Premier chargement à froid d'une page à la demande (lazy) : plus long que le délai par défaut.
  }, 20_000);

  it("affiche la page Budgets sur /budgets", async () => {
    renderAt("/budgets");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Budgets" }, { timeout: 8000 }),
    ).toBeInTheDocument();
  });

  it("redirige une URL inconnue vers l’accueil", async () => {
    renderAt("/inconnue");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Accueil" }, { timeout: 8000 }),
    ).toBeInTheDocument();
  });
});

describe("premier lancement", () => {
  it("redirige vers l’onboarding tant qu’aucun réglage n’existe", async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    renderAt("/plus/wallets");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Suivez votre argent" }),
    ).toBeInTheDocument();
  });
});
