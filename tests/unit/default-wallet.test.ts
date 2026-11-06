import { describe, expect, it } from "vitest";
import { resolveSourceWalletId } from "../../src/domain/default-wallet";

describe("portefeuille source du formulaire de transaction", () => {
  it("garde le portefeuille choisi par l'utilisateur", () => {
    expect(
      resolveSourceWalletId({ selected: "b", defaultWalletId: "a", activeWalletIds: ["a", "b"] }),
    ).toBe("b");
  });

  it("retient le portefeuille par défaut s'il est actif", () => {
    expect(
      resolveSourceWalletId({ selected: "", defaultWalletId: "b", activeWalletIds: ["a", "b"] }),
    ).toBe("b");
  });

  it("ignore un portefeuille par défaut supprimé ou archivé et prend le premier actif", () => {
    expect(
      resolveSourceWalletId({ selected: "", defaultWalletId: "supprime", activeWalletIds: ["a", "b"] }),
    ).toBe("a");
  });

  it("renvoie une valeur vide quand aucun portefeuille actif n'existe", () => {
    expect(resolveSourceWalletId({ selected: "", defaultWalletId: "x", activeWalletIds: [] })).toBe("");
  });
});
