import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { categorySchema } from "../../src/db/entities";
import { DEFAULT_CATEGORIES, defaultCategoryId } from "../../src/features/categories/defaults";
import {
  removeDuplicateDefaultCategories,
  restoreDefaultCategories,
} from "../../src/features/categories/category-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`defaults-dedupe-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

const BASE = "2026-01-01T00:00:00.000Z";

async function putCategory(
  id: string,
  name: string,
  kind: "expense" | "income",
  extra: { origin?: string; archived?: boolean; createdAt?: string } = {},
) {
  await db.categories.put({
    id,
    name,
    kind,
    icon: "📦",
    color: "#000000",
    sortOrder: 0,
    archived: extra.archived ?? false,
    createdAt: extra.createdAt ?? BASE,
    updatedAt: BASE,
    ...(extra.origin === undefined ? {} : { origin: extra.origin }),
  } as never);
}

describe("identifiant stable des catégories par défaut", () => {
  it("est déterministe, au format UUID accepté par le schéma", () => {
    const id = defaultCategoryId("income", "Salaire");
    expect(id).toBe(defaultCategoryId("income", "Salaire"));
    expect(categorySchema.shape.id.safeParse(id).success).toBe(true);
  });

  it("est unique pour chaque catégorie du jeu par défaut", () => {
    const ids = DEFAULT_CATEGORIES.map((d) => defaultCategoryId(d.kind, d.name));
    expect(new Set(ids).size).toBe(DEFAULT_CATEGORIES.length);
  });

  it("ignore la casse et les espaces, comme la clé d'origine", () => {
    expect(defaultCategoryId("expense", "  alimentation ")).toBe(defaultCategoryId("expense", "Alimentation"));
  });
});

describe("restauration concurrente", () => {
  it("deux appels simultanés ne créent pas de doublon", async () => {
    await Promise.all([restoreDefaultCategories(db), restoreDefaultCategories(db)]);
    const all = await db.categories.toArray();
    expect(all).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(new Set(all.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length);
  });

  it("une seconde restauration ne fait rien", async () => {
    expect(await restoreDefaultCategories(db)).toBe(DEFAULT_CATEGORIES.length);
    expect(await restoreDefaultCategories(db)).toBe(0);
  });
});

describe("suppression des doublons de catégories par défaut", () => {
  it("fusionne les doublons et déplace les transactions vers la catégorie conservée", async () => {
    const keepId = defaultCategoryId("expense", "Alimentation");
    const dupId = "22222222-2222-4222-8222-222222222222";
    await putCategory(keepId, "Alimentation", "expense", {
      origin: "expense|alimentation",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await putCategory(dupId, "Alimentation", "expense", { createdAt: "2025-12-01T00:00:00.000Z" });
    await db.transactions.put({ id: "t1", categoryId: dupId } as never);

    expect(await removeDuplicateDefaultCategories(db)).toBe(1);

    const remaining = await db.categories.toArray();
    expect(remaining.map((c) => c.id)).toEqual([keepId]);
    expect((await db.transactions.get("t1"))?.categoryId).toBe(keepId);
  });

  it("deux appareils aux lignes différentes gardent la même catégorie (pas de double suppression)", async () => {
    // Même jeu de lignes sur les deux appareils ; seule l'origine (locale) diffère selon l'appareil.
    const stableId = defaultCategoryId("expense", "Logement");
    const oldId = "99999999-9999-4999-8999-999999999999";
    const base = { name: "Logement", kind: "expense" as const, icon: "🏠", color: "#000", sortOrder: 0, archived: false, updatedAt: BASE };
    const oldRow = { ...base, id: oldId, createdAt: "2025-01-01T00:00:00.000Z" };
    const stableRow = { ...base, id: stableId, createdAt: "2026-11-05T00:00:00.000Z", origin: "expense|logement" };
    const deviceA = new AppDatabase(`defaults-dev-a-${Math.random().toString(36).slice(2)}`);
    const deviceB = new AppDatabase(`defaults-dev-b-${Math.random().toString(36).slice(2)}`);
    try {
      await deviceA.categories.bulkPut([oldRow, stableRow] as never);
      await deviceB.categories.bulkPut([{ ...oldRow, origin: "expense|logement" }, stableRow] as never);
      await removeDuplicateDefaultCategories(deviceA);
      await removeDuplicateDefaultCategories(deviceB);
      expect((await deviceA.categories.toArray()).map((c) => c.id)).toEqual([stableId]);
      expect((await deviceB.categories.toArray()).map((c) => c.id)).toEqual([stableId]);
    } finally {
      await deviceA.delete();
      await deviceB.delete();
    }
  });

  it("garde la catégorie active plutôt qu'une archivée, même plus ancienne", async () => {
    const archivedId = "33333333-3333-4333-8333-333333333333";
    const activeId = "44444444-4444-4444-8444-444444444444";
    await putCategory(archivedId, "Divers", "expense", { archived: true, createdAt: "2025-01-01T00:00:00.000Z" });
    await putCategory(activeId, "Divers", "expense", { createdAt: "2026-02-01T00:00:00.000Z" });

    await removeDuplicateDefaultCategories(db);

    expect((await db.categories.toArray()).map((c) => c.id)).toEqual([activeId]);
  });

  it("ne touche pas aux catégories personnalisées ni aux doublons de nature différente", async () => {
    await putCategory("55555555-5555-4555-8555-555555555555", "Divers", "income");
    await putCategory("66666666-6666-4666-8666-666666666666", "Projet perso", "expense");
    await putCategory("77777777-7777-4777-8777-777777777777", "Projet perso", "expense");

    expect(await removeDuplicateDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(3);
  });

  it("après un doublon synchronisé, la restauration ne recrée rien", async () => {
    await restoreDefaultCategories(db);
    await putCategory("88888888-8888-4888-8888-888888888888", "Salaire", "income");

    expect(await removeDuplicateDefaultCategories(db)).toBe(1);
    expect(await restoreDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });
});
