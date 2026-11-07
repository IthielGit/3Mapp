import { describe, expect, it } from "vitest";
import { categoryChoices } from "../../src/domain/category-options";

const categories = [
  { id: "a", name: "Logement", kind: "expense" as const },
  { id: "b", name: "Alimentation", kind: "expense" as const },
  { id: "c", name: "Ancienne", kind: "expense" as const, archived: true },
  { id: "d", name: "Salaire", kind: "income" as const },
];

describe("categoryChoices", () => {
  it("garde la nature voulue, sans les archivées, par ordre alphabétique", () => {
    expect(categoryChoices(categories, "expense").map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("garde la catégorie archivée de l'élément modifié", () => {
    expect(categoryChoices(categories, "expense", "c").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("n'ajoute pas une catégorie de l'autre nature", () => {
    expect(categoryChoices(categories, "expense", "d").map((c) => c.id)).toEqual(["b", "a"]);
  });
});
