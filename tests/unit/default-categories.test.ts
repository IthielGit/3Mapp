import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { createCategory, restoreDefaultCategories } from "../../src/features/categories/category-service";
import { DEFAULT_CATEGORIES, missingDefaultCategories } from "../../src/features/categories/defaults";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`default-categories-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe("catégories par défaut manquantes", () => {
  it("sans aucune catégorie, toutes les catégories par défaut sont manquantes", () => {
    expect(missingDefaultCategories([])).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it("ignore la casse et les espaces autour du nom", () => {
    const missing = missingDefaultCategories([{ name: "  alimentation ", kind: "expense" }]);
    expect(missing.map((c) => c.name)).not.toContain("Alimentation");
    expect(missing).toHaveLength(DEFAULT_CATEGORIES.length - 1);
  });

  it("compare aussi la nature : « Salaire » en dépense reste un manque côté revenu", () => {
    const missing = missingDefaultCategories([{ name: "Salaire", kind: "expense" }]);
    expect(missing.find((c) => c.name === "Salaire")).toBeDefined();
  });
});

describe("restaurer les catégories par défaut", () => {
  it("ajoute les catégories absentes puis ne fait plus rien", async () => {
    expect(await restoreDefaultCategories(db)).toBe(DEFAULT_CATEGORIES.length);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await restoreDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it("ne modifie pas une catégorie existante ni ne crée de doublon", async () => {
    await createCategory(
      { name: "Alimentation", kind: "expense", icon: "🥖", color: "#000000", archived: false },
      db,
    );
    const added = await restoreDefaultCategories(db);
    expect(added).toBe(DEFAULT_CATEGORIES.length - 1);
    const food = (await db.categories.toArray()).filter((c) => c.name === "Alimentation");
    expect(food).toHaveLength(1);
    expect(food[0]?.icon).toBe("🥖");
  });

  it("une catégorie archivée compte comme présente", async () => {
    await createCategory(
      { name: "Divers", kind: "expense", icon: "📦", color: "#64748b", archived: true },
      db,
    );
    await restoreDefaultCategories(db);
    expect((await db.categories.toArray()).filter((c) => c.name === "Divers")).toHaveLength(1);
  });
});
