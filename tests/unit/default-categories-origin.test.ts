import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { defaultOrigin, originBackfill, DEFAULT_CATEGORIES } from "../../src/features/categories/defaults";
import { backfillCategoryOrigins, restoreDefaultCategories } from "../../src/features/categories/category-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`defaults-origin-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

function defaultByName(name: string) {
  const found = DEFAULT_CATEGORIES.find((d) => d.name === name);
  if (!found) throw new Error(`catégorie absente : ${name}`);
  return found;
}

const ASSURANCES = defaultByName("Assurances");

async function putCategory(name: string, kind: "expense" | "income", origin?: string, id = crypto.randomUUID()) {
  await db.categories.put({
    id,
    name,
    kind,
    icon: "📦",
    color: "#000000",
    sortOrder: 0,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...(origin === undefined ? {} : { origin }),
  } as never);
}

describe("origine des catégories par défaut", () => {
  it("une catégorie renommée n'est pas recréée par la restauration", async () => {
    await putCategory("Assurance auto", "expense", defaultOrigin(ASSURANCES));

    await restoreDefaultCategories(db);

    expect(await db.categories.filter((c) => c.name === "Assurances").count()).toBe(0);
    expect(await db.categories.filter((c) => c.name === "Assurance auto").count()).toBe(1);
  });

  it("une catégorie par défaut supprimée est recréée par la restauration, avec son origine", async () => {
    await restoreDefaultCategories(db);

    const restored = await db.categories.filter((c) => c.name === "Assurances").toArray();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.origin).toBe(defaultOrigin(ASSURANCES));
  });

  it("l'origine est rattachée aux catégories existantes (une seule fois)", async () => {
    await putCategory("Assurances", "expense");
    await putCategory("Mon projet", "expense");

    expect(await backfillCategoryOrigins(db)).toBe(1);
    const assurances = await db.categories.filter((c) => c.name === "Assurances").first();
    expect(assurances?.origin).toBe(defaultOrigin(ASSURANCES));
    const custom = await db.categories.filter((c) => c.name === "Mon projet").first();
    expect(custom?.origin).toBeUndefined();

    expect(await backfillCategoryOrigins(db)).toBe(0);
  });

  it("une même origine n'est revendiquée qu'une fois (doublons existants)", () => {
    const updates = originBackfill([
      { id: "a", name: "Assurances", kind: "expense" },
      { id: "b", name: "assurances", kind: "expense" },
    ]);
    expect(updates).toEqual([{ id: "a", origin: defaultOrigin(ASSURANCES) }]);
  });
});
