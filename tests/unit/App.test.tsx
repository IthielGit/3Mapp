import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
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

describe("navigation mobile", () => {
  it("affiche les 5 onglets de la barre basse", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation");
    for (const label of ["Accueil", "Transactions", "Stats", "Budgets", "Plus"]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it("affiche la page Budgets sur /budgets", () => {
    renderAt("/budgets");
    expect(screen.getByRole("heading", { level: 1, name: "Budgets" })).toBeInTheDocument();
  });

  it("redirige une URL inconnue vers l’accueil", () => {
    renderAt("/inconnue");
    expect(screen.getByRole("heading", { level: 1, name: "Accueil" })).toBeInTheDocument();
  });
});
