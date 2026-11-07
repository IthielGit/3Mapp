import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { categorySchema } from "../../src/db/entities";
import { InUseError, RuleError } from "../../src/db/errors";
import { moveItem, sortOrderChanges } from "../../src/domain/ordering";
import { DEFAULT_CATEGORIES } from "../../src/features/categories/defaults";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  mergeCategories,
} from "../../src/features/categories/category-service";
import { completeOnboarding, isOnboarded } from "../../src/features/onboarding/onboarding-service";
import {
  createWallet,
  deleteWallet,
  isWalletUsed,
  moveWallet,
  setWalletArchived,
} from "../../src/features/wallets/wallet-service";

let testDb: AppDatabase;

beforeEach(() => {
  testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await testDb.delete();
});

const walletInput = {
  name: "Banque",
  icon: "🏦",
  color: "#0f766e",
  group: "bank" as const,
  currency: "MGA" as const,
  initialBalance: 0,
  includeInTotal: true,
  archived: false,
};

/** Transaction minimale valide, pour tester les références (suppression bloquée, fusion). */
function transactionFor(walletId: string, categoryId?: string, subcategoryId?: string) {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    type: "expense" as const,
    amount: 1000,
    currency: "MGA" as const,
    walletId,
    memo: "",
    attachmentIds: [],
    date: now,
    status: "posted" as const,
    ...(categoryId ? { categoryId } : {}),
    ...(subcategoryId ? { subcategoryId } : {}),
  };
}

describe("ordre (domain/ordering)", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("échange avec le voisin", () => {
    expect(moveItem(items, "b", -1).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, "b", 1).map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("ne sort pas des bornes", () => {
    expect(moveItem(items, "a", -1).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(moveItem(items, "c", 1).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("ne retourne que les sortOrder à corriger", () => {
    const ordered = [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 5 },
      { id: "c", sortOrder: 2 },
    ];
    expect(sortOrderChanges(ordered)).toEqual([{ id: "b", sortOrder: 1 }]);
  });
});

describe("jeu de catégories par défaut", () => {
  it("toutes les entrées sont valides selon le schéma", () => {
    for (const def of DEFAULT_CATEGORIES) {
      const result = categorySchema.safeParse({
        ...def,
        id: crypto.randomUUID(),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        sortOrder: 0,
      });
      expect(result.success, def.name).toBe(true);
    }
  });
});

describe("onboarding", () => {
  const input = {
    language: "fr" as const,
    baseCurrency: "MGA" as const,
    wallet: {
      name: "Compte principal",
      icon: "🏦",
      color: "#0f766e",
      group: "bank" as const,
      currency: "MGA" as const,
      initialBalance: 150000,
    },
  };

  it("crée réglages, devises, premier portefeuille et catégories", async () => {
    expect(await isOnboarded(testDb)).toBe(false);
    await completeOnboarding(input, testDb);

    expect(await isOnboarded(testDb)).toBe(true);
    expect(await testDb.settings.count()).toBe(1);
    expect(await testDb.currencies.count()).toBe(3);
    const wallets = await testDb.wallets.toArray();
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.initialBalance).toBe(150000);
    expect((await testDb.settings.toArray())[0]?.defaultWalletId).toBe(wallets[0]?.id);
    expect(await testDb.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it("ne peut pas être relancé", async () => {
    await completeOnboarding(input, testDb);
    await expect(completeOnboarding(input, testDb)).rejects.toThrow();
    expect(await testDb.wallets.count()).toBe(1);
  });
});

describe("portefeuilles", () => {
  it("numérotation d’ordre à la création", async () => {
    const a = await createWallet(walletInput, testDb);
    const b = await createWallet({ ...walletInput, name: "Espèces" }, testDb);
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
  });

  it("archivage et restauration", async () => {
    const w = await createWallet(walletInput, testDb);
    const archived = await setWalletArchived(w.id, true, testDb);
    expect(archived.archived).toBe(true);
    const restored = await setWalletArchived(w.id, false, testDb);
    expect(restored.archived).toBe(false);
  });

  it("suppression bloquée si une transaction utilise le portefeuille", async () => {
    const w = await createWallet(walletInput, testDb);
    await testDb.transactions.add(transactionFor(w.id));

    expect(await isWalletUsed(w.id, testDb)).toBe(true);
    await expect(deleteWallet(w.id, testDb)).rejects.toBeInstanceOf(InUseError);
    expect(await testDb.wallets.get(w.id)).toBeDefined();
  });

  it("suppression autorisée si le portefeuille est inutilisé", async () => {
    const w = await createWallet(walletInput, testDb);
    await deleteWallet(w.id, testDb);
    expect(await testDb.wallets.get(w.id)).toBeUndefined();
  });

  it("réordonnancement persistant", async () => {
    const a = await createWallet(walletInput, testDb);
    const b = await createWallet({ ...walletInput, name: "Espèces" }, testDb);
    await moveWallet(b.id, -1, testDb);
    expect((await testDb.wallets.get(b.id))?.sortOrder).toBe(0);
    expect((await testDb.wallets.get(a.id))?.sortOrder).toBe(1);
  });
});

describe("catégories", () => {
  const expenseInput = {
    name: "Restaurants",
    kind: "expense" as const,
    icon: "🍽️",
    color: "#d97706",
    archived: false,
  };

  it("ordre séparé par nature (dépense / revenu)", async () => {
    const e = await createCategory(expenseInput, testDb);
    const i = await createCategory({ ...expenseInput, name: "Primes", kind: "income" }, testDb);
    expect(e.sortOrder).toBe(0);
    expect(i.sortOrder).toBe(0);
  });

  it("suppression bloquée si une transaction utilise la catégorie", async () => {
    const w = await createWallet(walletInput, testDb);
    const c = await createCategory(expenseInput, testDb);
    await testDb.transactions.add(transactionFor(w.id, c.id));
    await expect(deleteCategory(c.id, testDb)).rejects.toBeInstanceOf(InUseError);
  });

  it("suppression bloquée si une sous-catégorie utilisée", async () => {
    const w = await createWallet(walletInput, testDb);
    const c = await createCategory(expenseInput, testDb);
    const s = await createSubcategory(c.id, "Fast-food", "🍔", testDb);
    await testDb.transactions.add(transactionFor(w.id, c.id, s.id));
    await expect(deleteCategory(c.id, testDb)).rejects.toBeInstanceOf(InUseError);
    expect(await testDb.subcategories.get(s.id)).toBeDefined();
  });

  it("suppression autorisée et sous-catégories inutilisées supprimées", async () => {
    const c = await createCategory(expenseInput, testDb);
    const s = await createSubcategory(c.id, "Brunch", "🥐", testDb);
    await deleteCategory(c.id, testDb);
    expect(await testDb.categories.get(c.id)).toBeUndefined();
    expect(await testDb.subcategories.get(s.id)).toBeUndefined();
  });

  it("sous-catégorie utilisée non supprimable", async () => {
    const w = await createWallet(walletInput, testDb);
    const c = await createCategory(expenseInput, testDb);
    const s = await createSubcategory(c.id, "Brunch", "🥐", testDb);
    await testDb.transactions.add(transactionFor(w.id, c.id, s.id));
    await expect(deleteSubcategory(s.id, testDb)).rejects.toBeInstanceOf(InUseError);
  });

  it("fusion déplace transactions et budgets vers la cible", async () => {
    const w = await createWallet(walletInput, testDb);
    const from = await createCategory(expenseInput, testDb);
    const into = await createCategory({ ...expenseInput, name: "Repas" }, testDb);
    const tx = transactionFor(w.id, from.id);
    await testDb.transactions.add(tx);
    await testDb.budgets.add({
      id: crypto.randomUUID(),
      createdAt: tx.createdAt,
      updatedAt: tx.createdAt,
      name: "Budget",
      amount: 100000,
      currency: "MGA",
      period: "month",
      startDate: tx.createdAt,
      categoryIds: [from.id, into.id],
      walletIds: [w.id],
      rollover: false,
      alertThreshold: 80,
    });

    await mergeCategories(from.id, into.id, testDb);

    expect(await testDb.categories.get(from.id)).toBeUndefined();
    expect((await testDb.transactions.get(tx.id))?.categoryId).toBe(into.id);
    const budget = (await testDb.budgets.toArray())[0];
    expect(budget?.categoryIds).toEqual([into.id]);
  });

  it("fusion refusée entre dépense et revenu", async () => {
    const dep = await createCategory(expenseInput, testDb);
    const rev = await createCategory({ ...expenseInput, name: "Salaire", kind: "income" }, testDb);
    await expect(mergeCategories(dep.id, rev.id, testDb)).rejects.toBeInstanceOf(RuleError);
  });
});
