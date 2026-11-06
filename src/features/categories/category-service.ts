import { db as defaultDb, type AppDatabase } from "../../db/database";
import { InUseError, RuleError } from "../../db/errors";
import {
  categorySchema,
  subcategorySchema,
  type Category,
  type Subcategory,
} from "../../db/entities";
import { createRepository } from "../../db/repositories";
import { moveItem, sortOrderChanges } from "../../domain/ordering";
import { missingDefaultCategories } from "./defaults";

export type CategoryInput = Omit<Category, "id" | "createdAt" | "updatedAt" | "sortOrder">;

function categoryRepo(database: AppDatabase) {
  return createRepository(database.categories, categorySchema);
}

function subcategoryRepo(database: AppDatabase) {
  return createRepository(database.subcategories, subcategorySchema);
}

/** Vrai si la catégorie est référencée par une transaction, une récurrence ou un budget. */
export async function isCategoryUsed(
  categoryId: string,
  database: AppDatabase = defaultDb,
): Promise<boolean> {
  const inTransactions = await database.transactions
    .filter((t) => t.categoryId === categoryId)
    .first();
  if (inTransactions) return true;

  const inRecurring = await database.recurring.filter((r) => r.categoryId === categoryId).first();
  if (inRecurring) return true;

  const inBudgets = await database.budgets
    .filter((b) => b.categoryIds.includes(categoryId))
    .first();
  return inBudgets !== undefined;
}

export async function isSubcategoryUsed(
  subcategoryId: string,
  database: AppDatabase = defaultDb,
): Promise<boolean> {
  const found = await database.transactions
    .filter((t) => t.subcategoryId === subcategoryId)
    .first();
  return found !== undefined;
}

export async function createCategory(input: CategoryInput, database: AppDatabase = defaultDb) {
  const repo = categoryRepo(database);
  const sameKind = (await repo.list()).filter((c) => c.kind === input.kind);
  const sortOrder = sameKind.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  return repo.create({ ...input, sortOrder });
}

/**
 * Ajoute les catégories par défaut qui manquent (jamais de doublon, rien n'est modifié ni supprimé).
 * Retourne le nombre de catégories ajoutées.
 */
export async function restoreDefaultCategories(database: AppDatabase = defaultDb): Promise<number> {
  const missing = missingDefaultCategories(await database.categories.toArray());
  if (missing.length === 0) return 0;
  await database.transaction("rw", database.categories, async () => {
    for (const category of missing) {
      await createCategory({ ...category, archived: false }, database);
    }
  });
  return missing.length;
}

export async function updateCategory(
  id: string,
  patch: Partial<Omit<CategoryInput, "kind">>,
  database: AppDatabase = defaultDb,
) {
  return categoryRepo(database).update(id, patch);
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
  database: AppDatabase = defaultDb,
) {
  return categoryRepo(database).update(id, { archived });
}

export async function deleteCategory(id: string, database: AppDatabase = defaultDb): Promise<void> {
  if (await isCategoryUsed(id, database)) throw new InUseError("category");
  const subs = await database.subcategories.where("categoryId").equals(id).toArray();
  for (const sub of subs) {
    if (await isSubcategoryUsed(sub.id, database)) throw new InUseError("subcategory");
  }
  await database.transaction("rw", [database.categories, database.subcategories], async () => {
    await database.subcategories.where("categoryId").equals(id).delete();
    await database.categories.delete(id);
  });
}

/** Réordonne au sein de la même nature (dépense ou revenu). */
export async function moveCategory(
  id: string,
  direction: -1 | 1,
  database: AppDatabase = defaultDb,
): Promise<void> {
  const repo = categoryRepo(database);
  const all = await repo.list();
  const current = all.find((c) => c.id === id);
  if (!current) return;
  const sameKind = all
    .filter((c) => c.kind === current.kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const change of sortOrderChanges(moveItem(sameKind, id, direction))) {
    await repo.update(change.id, { sortOrder: change.sortOrder });
  }
}

/**
 * Fusionne `fromId` dans `intoId` : toutes les références sont déplacées, puis `fromId` est supprimée.
 * Opération atomique (tout ou rien).
 */
export async function mergeCategories(
  fromId: string,
  intoId: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  if (fromId === intoId) throw new RuleError("Fusion dans la même catégorie");
  const from = await database.categories.get(fromId);
  const into = await database.categories.get(intoId);
  if (!from || !into) throw new RuleError("Catégorie introuvable");
  if (from.kind !== into.kind) throw new RuleError("Fusion impossible entre dépense et revenu");

  await database.transaction(
    "rw",
    [
      database.categories,
      database.subcategories,
      database.transactions,
      database.budgets,
      database.recurring,
    ],
    async () => {
      await database.transactions
        .filter((t) => t.categoryId === fromId)
        .modify((t) => {
          t.categoryId = intoId;
        });
      await database.recurring
        .filter((r) => r.categoryId === fromId)
        .modify((r) => {
          r.categoryId = intoId;
        });
      await database.budgets
        .filter((b) => b.categoryIds.includes(fromId))
        .modify((b) => {
          b.categoryIds = [...new Set(b.categoryIds.map((c) => (c === fromId ? intoId : c)))];
        });
      await database.subcategories
        .where("categoryId")
        .equals(fromId)
        .modify((s) => {
          s.categoryId = intoId;
        });
      await database.categories.delete(fromId);
    },
  );
}

export async function createSubcategory(
  categoryId: string,
  name: string,
  icon: string,
  database: AppDatabase = defaultDb,
): Promise<Subcategory> {
  return subcategoryRepo(database).create({ categoryId, name, icon });
}

export async function updateSubcategory(
  id: string,
  patch: { name?: string; icon?: string },
  database: AppDatabase = defaultDb,
): Promise<Subcategory> {
  return subcategoryRepo(database).update(id, patch);
}

export async function deleteSubcategory(
  id: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  if (await isSubcategoryUsed(id, database)) throw new InUseError("subcategory");
  await subcategoryRepo(database).remove(id);
}
