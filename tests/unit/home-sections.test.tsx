import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Wallet } from "../../src/db/entities";
import { WalletsSection } from "../../src/features/home/HomeSections";
import type { HomeData } from "../../src/features/home/useHomeData";

function wallet(id: string): Wallet {
  return {
    id,
    name: `Compte ${id}`,
    currency: "MGA",
    initialBalance: 0,
    icon: "🏦",
    color: "#0B7E9D",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as Wallet;
}

function stale(w: Wallet, daysSince: number): HomeData["stale"][number] {
  return { wallet: w, lastActivity: new Date(2026, 0, 1), daysSince };
}

describe("Accueil : section Portefeuilles", () => {
  it("limite à quatre cartes, propose de voir les autres, virement et réconciliation", () => {
    const active = ["1", "2", "3", "4", "5", "6"].map(wallet);
    render(
      <MemoryRouter>
        <WalletsSection active={active} balances={{}} stale={[stale(wallet("5"), 40)]} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Voir les 6 portefeuilles" })).toHaveAttribute("href", "/plus/wallets");
    expect(screen.getByRole("link", { name: "Virement" })).toHaveAttribute("href", "/transactions/new?type=transfer");
    expect(screen.getByRole("link", { name: "Réconcilier · 1 portefeuille en retard, en commençant par Compte 5" })).toHaveAttribute(
      "href",
      "/plus/wallets/5/reconcile",
    );
    expect(screen.getByRole("link", { name: "Tout voir : portefeuilles" })).toBeInTheDocument();
  });

  it("un seul portefeuille : pas de virement, réconciliation de ce portefeuille", () => {
    const active = [wallet("1")];
    render(
      <MemoryRouter>
        <WalletsSection active={active} balances={{}} stale={[]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Virement" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Voir les/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Réconcilier Compte 1" })).toHaveAttribute(
      "href",
      "/plus/wallets/1/reconcile",
    );
  });
});

describe("Accueil : retard de saisie sur les tuiles", () => {
  it("marque chaque portefeuille en retard et compte les retards sur « Réconcilier »", () => {
    const active = ["1", "2", "3"].map(wallet);
    render(
      <MemoryRouter>
        <WalletsSection
          active={active}
          balances={{}}
          stale={[stale(wallet("1"), 90), stale(wallet("3"), 31)]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("90 j")).toBeInTheDocument();
    expect(screen.getByText("31 j")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Compte 1, sans saisie depuis 90 jours/ })).toHaveAttribute(
      "href",
      "/plus/wallets/1",
    );
    const reconcile = screen.getByRole("link", { name: "Réconcilier · 2 portefeuilles en retard, en commençant par Compte 1" });
    expect(reconcile).toHaveTextContent("Réconcilier · 2");
    expect(reconcile).toHaveAttribute("href", "/plus/wallets/1/reconcile");
  });
});
