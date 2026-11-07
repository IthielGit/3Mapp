import { describe, expect, it } from "vitest";
import {
  canTransfer,
  capList,
  HOME_WALLET_LIMIT,
  reconcileTarget,
  showBudgetsSection,
  showRecentSection,
} from "../../src/domain/home-layout";

describe("accueil : limite de la liste", () => {
  it("garde tout sous la limite", () => {
    expect(capList([1, 2, 3], HOME_WALLET_LIMIT)).toEqual({ shown: [1, 2, 3], hiddenCount: 0 });
  });

  it("coupe à la limite et compte le reste", () => {
    expect(capList([1, 2, 3, 4, 5, 6], 4)).toEqual({ shown: [1, 2, 3, 4], hiddenCount: 2 });
  });

  it("exactement à la limite : rien de caché", () => {
    expect(capList([1, 2, 3, 4], 4).hiddenCount).toBe(0);
  });

  it("une limite négative ou décimale reste sûre", () => {
    expect(capList([1, 2], -1)).toEqual({ shown: [], hiddenCount: 2 });
    expect(capList([1, 2, 3], 1.7)).toEqual({ shown: [1], hiddenCount: 2 });
  });
});

describe("accueil : virement", () => {
  it("demande au moins deux portefeuilles", () => {
    expect(canTransfer(0)).toBe(false);
    expect(canTransfer(1)).toBe(false);
    expect(canTransfer(2)).toBe(true);
  });
});

describe("accueil : cible de la réconciliation", () => {
  const a = { id: "a" };
  const b = { id: "b" };

  it("aucun portefeuille : aucune action", () => {
    expect(reconcileTarget([], [])).toBeNull();
  });

  it("le portefeuille le plus en retard passe en premier", () => {
    expect(reconcileTarget([a, b], [{ wallet: b }, { wallet: a }])).toEqual({ kind: "wallet", walletId: "b" });
  });

  it("un seul portefeuille à jour : ce portefeuille", () => {
    expect(reconcileTarget([a], [])).toEqual({ kind: "wallet", walletId: "a" });
  });

  it("plusieurs portefeuilles à jour : la liste pour choisir", () => {
    expect(reconcileTarget([a, b], [])).toEqual({ kind: "list" });
  });
});

describe("accueil : sections masquées au premier lancement", () => {
  it("budgets : masqués sans budget ni transaction", () => {
    expect(showBudgetsSection(0, 0)).toBe(false);
    expect(showBudgetsSection(0, 3)).toBe(true);
    expect(showBudgetsSection(1, 0)).toBe(true);
  });

  it("dernières transactions : masquées sans aucune transaction", () => {
    expect(showRecentSection(0, 0)).toBe(false);
    expect(showRecentSection(0, 2)).toBe(true);
    expect(showRecentSection(2, 2)).toBe(true);
  });
});
