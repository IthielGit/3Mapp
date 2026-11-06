import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import {
  DEFAULT_CATEGORIES,
  DEFAULTS_VERSION,
  defaultCategoriesAfter,
  defaultCategoryVersion,
} from "../../src/features/categories/defaults";
import { applyDefaultCategoryUpdates } from "../../src/features/categories/category-service";

function byName(name: string) {
  const found = DEFAULT_CATEGORIES.find((d) => d.name === name);
  if (!found) throw new Error(`catégorie absente : ${name}`);
  return found;
}

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`defaults-update-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

async function putSettings(version?: number) {
  await db.settings.put({
    id: "settings",
    baseCurrency: "MGA",
    monthStartDay: 1,
    weekStartDay: 1,
    language: "fr",
    theme: "system",
    ...(version === undefined ? {} : { defaultCategoriesVersion: version }),
  } as never);
}

/** Catégories d'un compte qui a déjà reçu la version 1 : toutes les catégories d'origine. */
async function seedVersionOneAccount() {
  const v1 = DEFAULT_CATEGORIES.filter((d) => defaultCategoryVersion(d) === 1);
  for (const d of v1) {
    await db.categories.put({
      id: crypto.randomUUID(),
      name: d.name,
      kind: d.kind,
      icon: d.icon,
      color: d.color,
      sortOrder: 0,
      archived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);
  }
}

describe("jeu de catégories par défaut : versions", () => {
  it("les nouvelles catégories sont de la version 2 ; les anciennes de la version 1", () => {
    expect(DEFAULTS_VERSION).toBe(3);
    expect(defaultCategoryVersion(byName("Activité annexe"))).toBe(3);
    expect(defaultCategoriesAfter(1).length).toBeGreaterThan(0);
    expect(defaultCategoriesAfter(DEFAULTS_VERSION)).toHaveLength(0);
    expect(defaultCategoryVersion(byName("Alimentation"))).toBe(1);
    expect(defaultCategoryVersion(byName("Primes"))).toBe(2);
  });
});

describe("mise à jour des catégories par défaut d'un compte", () => {
  it("ajoute les nouvelles catégories une seule fois et enregistre la version", async () => {
    await putSettings(); // compte sans marque : version 1
    await seedVersionOneAccount();

    const added = await applyDefaultCategoryUpdates(db);
    expect(added).toBe(defaultCategoriesAfter(1).length);
    expect((await db.settings.get("settings"))?.defaultCategoriesVersion).toBe(DEFAULTS_VERSION);
    expect((await db.categories.filter((c) => c.name === "Téléphone et internet").count())).toBe(1);

    expect(await applyDefaultCategoryUpdates(db)).toBe(0);
    expect(await db.categories.filter((c) => c.name === "Téléphone et internet").count()).toBe(1);
  });

  it("ne réintroduit pas une catégorie d'origine supprimée par l'utilisateur", async () => {
    await putSettings();
    await seedVersionOneAccount();
    await db.categories.filter((c) => c.name === "Divers").delete();

    await applyDefaultCategoryUpdates(db);
    expect(await db.categories.filter((c) => c.name === "Divers").count()).toBe(0);
  });

  it("ne crée pas de doublon quand la catégorie existe déjà sous le même nom", async () => {
    await putSettings();
    await seedVersionOneAccount();
    await db.categories.put({
      id: crypto.randomUUID(),
      name: "assurances",
      kind: "expense",
      icon: "🛡️",
      color: "#000000",
      sortOrder: 99,
      archived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);

    await applyDefaultCategoryUpdates(db);
    expect(await db.categories.where("kind").equals("expense").filter((c) => c.name.toLowerCase() === "assurances").count()).toBe(1);
  });

  it("ne fait rien quand le compte est déjà à la dernière version", async () => {
    await putSettings(DEFAULTS_VERSION);
    expect(await applyDefaultCategoryUpdates(db)).toBe(0);
    expect(await db.categories.count()).toBe(0);
  });

  it("ne fait rien sans réglages locaux", async () => {
    expect(await applyDefaultCategoryUpdates(db)).toBe(0);
    expect(await db.categories.count()).toBe(0);
  });
});
