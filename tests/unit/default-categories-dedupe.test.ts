import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { categorySchema } from "../../src/db/entities";
import { DEFAULT_CATEGORIES, defaultCategoryId } from "../../src/features/categories/defaults";
import {
  canonicalizeDefaultCategories,
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

function row(
  id: string,
  name: string,
  kind: "expense" | "income",
  extra: { origin?: string; archived?: boolean; createdAt?: string; icon?: string } = {},
) {
  return {
    id,
    name,
    kind,
    icon: extra.icon ?? "📦",
    color: "#000000",
    sortOrder: 0,
    archived: extra.archived ?? false,
    createdAt: extra.createdAt ?? BASE,
    updatedAt: BASE,
    ...(extra.origin === undefined ? {} : { origin: extra.origin }),
  };
}

async function putCategory(...args: Parameters<typeof row>) {
  await db.categories.put(row(...args) as never);
}

function transaction(id: string, categoryId: string) {
  return { id, categoryId, date: BASE } as never;
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

describe("fusion des copies de catégories par défaut dans la ligne stable", () => {
  it("fusionne la copie et déplace les transactions vers la ligne stable", async () => {
    const stableId = defaultCategoryId("expense", "Alimentation");
    const dupId = "22222222-2222-4222-8222-222222222222";
    await putCategory(stableId, "Alimentation", "expense", { origin: "expense|alimentation" });
    await putCategory(dupId, "Alimentation", "expense", { createdAt: "2025-12-01T00:00:00.000Z" });
    await db.transactions.put(transaction("t1", dupId));

    expect(await canonicalizeDefaultCategories(db)).toBe(1);

    expect((await db.categories.toArray()).map((c) => c.id)).toEqual([stableId]);
    expect((await db.transactions.get("t1"))?.categoryId).toBe(stableId);
  });

  it("ligne stable absente (supprimée ailleurs) : elle est recréée à partir de la copie, rien n'est perdu", async () => {
    // Cas du téléphone : ses copies locales (avec origine) restent, la ligne stable a été supprimée.
    const copyId = "33333333-3333-4333-8333-333333333333";
    await putCategory(copyId, "Logement", "expense", { origin: "expense|logement", icon: "🏡" });
    await db.transactions.put(transaction("t1", copyId));

    expect(await canonicalizeDefaultCategories(db)).toBe(1);

    const stableId = defaultCategoryId("expense", "Logement");
    const stable = await db.categories.get(stableId);
    expect(stable?.name).toBe("Logement");
    expect(stable?.icon).toBe("🏡");
    expect(stable?.origin).toBe("expense|logement");
    expect(await db.categories.get(copyId)).toBeUndefined();
    expect((await db.transactions.get("t1"))?.categoryId).toBe(stableId);
  });

  it("deux appareils aux lignes différentes convergent vers la ligne stable, sans jamais la supprimer", async () => {
    const stableId = defaultCategoryId("expense", "Divers");
    const oldId = "99999999-9999-4999-8999-999999999999";
    const otherId = "88888888-8888-4888-8888-888888888888";
    const deviceA = new AppDatabase(`defaults-dev-a-${Math.random().toString(36).slice(2)}`);
    const deviceB = new AppDatabase(`defaults-dev-b-${Math.random().toString(36).slice(2)}`);
    try {
      // A : ligne stable archivée + une copie active. B : deux copies, pas encore de ligne stable.
      await deviceA.categories.bulkPut([
        row(stableId, "Divers", "expense", { archived: true }),
        row(oldId, "Divers", "expense", { createdAt: "2025-01-01T00:00:00.000Z", origin: "expense|divers" }),
      ] as never);
      await deviceB.categories.bulkPut([
        row(oldId, "Divers", "expense", { createdAt: "2025-01-01T00:00:00.000Z" }),
        row(otherId, "Divers", "expense"),
      ] as never);

      await canonicalizeDefaultCategories(deviceA);
      await canonicalizeDefaultCategories(deviceB);

      const a = await deviceA.categories.toArray();
      const b = await deviceB.categories.toArray();
      expect(a.map((c) => c.id)).toEqual([stableId]);
      expect(b.map((c) => c.id)).toEqual([stableId]);
      // La copie active était visible : la catégorie le reste.
      expect(a[0]?.archived).toBe(false);
      expect(b[0]?.archived).toBe(false);
    } finally {
      await deviceA.delete();
      await deviceB.delete();
    }
  });

  it("toutes les copies archivées : la ligne stable créée est archivée", async () => {
    await putCategory("44444444-4444-4444-8444-444444444444", "Cadeaux", "income", { archived: true });
    await canonicalizeDefaultCategories(db);
    expect((await db.categories.get(defaultCategoryId("income", "Cadeaux")))?.archived).toBe(true);
  });

  it("une ligne stable renommée n'absorbe pas une catégorie qui porte l'ancien nom", async () => {
    const stableId = defaultCategoryId("expense", "Transport");
    const ownId = "55555555-5555-4555-8555-555555555555";
    await putCategory(stableId, "Voiture", "expense", { origin: "expense|transport" });
    await putCategory(ownId, "Transport", "expense");

    expect(await canonicalizeDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(2);
  });

  it("ne touche pas aux catégories personnelles ni aux noms de nature différente", async () => {
    await putCategory("66666666-6666-4666-8666-666666666666", "Projet perso", "expense");
    await putCategory("77777777-7777-4777-8777-777777777777", "Projet perso", "expense");
    await putCategory("12121212-1212-4212-8212-121212121212", "Salaire", "expense");

    expect(await canonicalizeDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(3);
  });

  it("la catégorie de paie suit la fusion", async () => {
    const copyId = "13131313-1313-4313-8313-131313131313";
    await db.settings.put({
      id: "settings",
      baseCurrency: "MGA",
      monthStartDay: 1,
      weekStartDay: 1,
      language: "fr",
      theme: "system",
      payIncomeCategoryId: copyId,
    } as never);
    await putCategory(copyId, "Salaire", "income");

    await canonicalizeDefaultCategories(db);
    expect((await db.settings.get("settings"))?.payIncomeCategoryId).toBe(defaultCategoryId("income", "Salaire"));
  });

  it("après une copie synchronisée, la restauration ne recrée rien", async () => {
    await restoreDefaultCategories(db);
    await putCategory("14141414-1414-4414-8414-141414141414", "Salaire", "income");

    expect(await canonicalizeDefaultCategories(db)).toBe(1);
    expect(await restoreDefaultCategories(db)).toBe(0);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });
});
