import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import {
  DEFAULT_CATEGORIES,
  defaultCategoryId,
  defaultKeyOf,
  defaultsToEnsure,
} from "../../src/features/categories/defaults";
import {
  deleteCategory,
  ensureDefaultCategories,
  mergeCategories,
  restoreDefaultCategories,
} from "../../src/features/categories/category-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`defaults-ensure-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

const BASE = "2026-01-01T00:00:00.000Z";

async function putSettings(extra: Record<string, unknown> = {}) {
  await db.settings.put({
    id: "settings",
    baseCurrency: "MGA",
    monthStartDay: 1,
    weekStartDay: 1,
    language: "fr",
    theme: "system",
    ...extra,
  } as never);
}

async function putCategory(id: string, name: string, kind: "expense" | "income", origin?: string) {
  await db.categories.put({
    id,
    name,
    kind,
    icon: "🚗",
    color: "#000000",
    sortOrder: 0,
    archived: false,
    createdAt: BASE,
    updatedAt: BASE,
    ...(origin === undefined ? {} : { origin }),
  } as never);
}

describe("defaultsToEnsure", () => {
  it("exclut les présentes (par nom ou par origine) et les masquées", () => {
    const toEnsure = defaultsToEnsure(
      [
        { name: "Alimentation", kind: "expense" },
        { name: "Voiture", kind: "expense", origin: "expense|transport" },
      ],
      ["expense|divers"],
    );
    const names = toEnsure.map((d) => `${d.kind}|${d.name}`);
    expect(names).not.toContain("expense|Alimentation");
    expect(names).not.toContain("expense|Transport");
    expect(names).not.toContain("expense|Divers");
    expect(toEnsure).toHaveLength(DEFAULT_CATEGORIES.length - 3);
  });

  it("defaultKeyOf : origine, sinon nom par défaut, sinon rien", () => {
    expect(defaultKeyOf({ name: "Voiture", kind: "expense", origin: "expense|transport" })).toBe("expense|transport");
    expect(defaultKeyOf({ name: "Salaire", kind: "income" })).toBe("income|salaire");
    expect(defaultKeyOf({ name: "Moto 🏍️", kind: "expense" })).toBeUndefined();
  });
});

describe("ensureDefaultCategories : réparation après une synchro", () => {
  it("compte qui n'a plus que « Moto » : les catégories par défaut reviennent, avec leur identifiant stable", async () => {
    await putSettings({ defaultCategoriesVersion: 3 });
    await putCategory("731d8045-b38b-4c03-9053-5a7c982da7b7", "Moto 🏍️", "expense");

    expect(await ensureDefaultCategories(db)).toBe(DEFAULT_CATEGORIES.length);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length + 1);
    const salary = await db.categories.get(defaultCategoryId("income", "Salaire"));
    expect(salary?.origin).toBe("income|salaire");
    // Rien de plus au passage suivant.
    expect(await ensureDefaultCategories(db)).toBe(0);
  });

  it("la date de modification des catégories recréées est récente (elle l'emporte sur une suppression plus ancienne)", async () => {
    await putSettings();
    const before = Date.now();
    await ensureDefaultCategories(db);
    const food = await db.categories.get(defaultCategoryId("expense", "Alimentation"));
    expect(Date.parse(food?.updatedAt ?? BASE)).toBeGreaterThanOrEqual(before);
  });

  it("ne recrée pas une catégorie renommée (son origine la représente)", async () => {
    await putSettings();
    await putCategory(defaultCategoryId("expense", "Transport"), "Voiture", "expense", "expense|transport");
    await ensureDefaultCategories(db);
    expect(await db.categories.filter((c) => c.name === "Transport").count()).toBe(0);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it("ne fait rien sans réglages locaux (l'onboarding s'en charge)", async () => {
    expect(await ensureDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(0);
  });
});

describe("suppression par l'utilisateur", () => {
  it("une catégorie par défaut supprimée n'est pas recréée, « Restaurer » la ramène", async () => {
    await putSettings();
    await ensureDefaultCategories(db);
    const diversId = defaultCategoryId("expense", "Divers");

    await deleteCategory(diversId, db);
    expect((await db.settings.get("settings"))?.hiddenDefaultCategories).toEqual(["expense|divers"]);
    expect(await ensureDefaultCategories(db)).toBe(0);
    expect(await db.categories.get(diversId)).toBeUndefined();

    expect(await restoreDefaultCategories(db)).toBe(1);
    expect(await db.categories.get(diversId)).toBeDefined();
    expect((await db.settings.get("settings"))?.hiddenDefaultCategories).toEqual([]);
  });

  it("une catégorie personnelle supprimée ne touche pas à la liste masquée", async () => {
    await putSettings();
    await putCategory("11111111-1111-4111-8111-111111111111", "Moto 🏍️", "expense");
    await deleteCategory("11111111-1111-4111-8111-111111111111", db);
    expect((await db.settings.get("settings"))?.hiddenDefaultCategories).toBeUndefined();
  });

  it("fusionner une catégorie par défaut dans une autre la masque", async () => {
    await putSettings();
    await ensureDefaultCategories(db);
    await mergeCategories(defaultCategoryId("expense", "Loisirs"), defaultCategoryId("expense", "Divers"), db);
    expect((await db.settings.get("settings"))?.hiddenDefaultCategories).toEqual(["expense|loisirs"]);
    expect(await ensureDefaultCategories(db)).toBe(0);
  });
});
