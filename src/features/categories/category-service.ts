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
import {
  DEFAULTS_VERSION,
  defaultCategoryId,
  defaultCategoryVersion,
  defaultOrigin,
  isDefaultCategoryKey,
  missingDefaultCategories,
  originBackfill,
  type DefaultCategory,
} from "./defaults";

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
 * Insère les catégories par défaut données, avec leur identifiant stable. Une catégorie dont l'identifiant
 * existe déjà n'est pas réinsérée. À appeler dans une transaction « rw » sur les catégories.
 * Retourne le nombre de catégories insérées.
 */
async function insertDefaultCategories(
  categories: readonly DefaultCategory[],
  database: AppDatabase,
): Promise<number> {
  let inserted = 0;
  for (const category of categories) {
    const id = defaultCategoryId(category.kind, category.name);
    if (await database.categories.get(id)) continue;
    const sameKind = (await database.categories.toArray()).filter((c) => c.kind === category.kind);
    const sortOrder = sameKind.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
    const now = new Date().toISOString();
    await database.categories.put(
      categorySchema.parse({
        id,
        name: category.name,
        kind: category.kind,
        icon: category.icon,
        color: category.color,
        archived: false,
        origin: defaultOrigin(category),
        sortOrder,
        createdAt: now,
        updatedAt: now,
      }),
    );
    inserted++;
  }
  return inserted;
}

/**
 * Ajoute les catégories par défaut qui manquent (jamais de doublon, rien n'est modifié ni supprimé).
 * La liste des manquantes est calculée dans la transaction, pour qu'un appel concurrent ne double rien.
 * Retourne le nombre de catégories ajoutées.
 */
export async function restoreDefaultCategories(database: AppDatabase = defaultDb): Promise<number> {
  let added = 0;
  await database.transaction("rw", database.categories, async () => {
    const missing = missingDefaultCategories(await database.categories.toArray());
    added = await insertDefaultCategories(missing, database);
  });
  return added;
}

/**
 * Propose à ce compte les catégories par défaut ajoutées depuis sa dernière version (une seule fois).
 * Les catégories déjà présentes ou supprimées avant cette version ne reviennent pas.
 * Retourne le nombre de catégories ajoutées. Sans réglages locaux, rien n'est fait.
 */
export async function applyDefaultCategoryUpdates(database: AppDatabase = defaultDb): Promise<number> {
  const settings = await database.settings.toCollection().first();
  if (!settings) return 0;
  await backfillCategoryOrigins(database);
  const stored = settings.defaultCategoriesVersion ?? 1;
  if (stored >= DEFAULTS_VERSION) return 0;

  let added = 0;
  await database.transaction("rw", database.categories, database.settings, async () => {
    const toAdd = missingDefaultCategories(await database.categories.toArray()).filter(
      (d) => defaultCategoryVersion(d) > stored,
    );
    added = await insertDefaultCategories(toAdd, database);
    await database.settings.update(settings.id, { defaultCategoriesVersion: DEFAULTS_VERSION });
  });
  return added;
}

/**
 * Fusionne les catégories par défaut dupliquées (même nature, même nom du jeu par défaut) dans une seule.
 * Les références sont déplacées vers la catégorie conservée.
 *
 * Le choix de la conservée ne repose que sur des champs synchronisés (archivée, identifiant stable,
 * date de création, identifiant) : deux appareils qui voient les mêmes lignes gardent la même. Un critère
 * local (ex. l'origine, remplie seulement sur certains appareils) ferait garder à chacun une copie
 * différente, puis supprimer celle de l'autre : la synchro effacerait alors toutes les copies.
 * Retourne le nombre de doublons supprimés.
 */
export async function removeDuplicateDefaultCategories(database: AppDatabase = defaultDb): Promise<number> {
  const groups = new Map<string, Category[]>();
  for (const category of await database.categories.toArray()) {
    const key = defaultOrigin(category);
    if (!isDefaultCategoryKey(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), category]);
  }

  const isStable = (c: Category) => c.id === defaultCategoryId(c.kind, c.name);

  let removed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keep, ...duplicates] = [...group].sort(
      (a, b) =>
        Number(a.archived) - Number(b.archived) ||
        Number(isStable(b)) - Number(isStable(a)) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
    if (!keep) continue;
    for (const duplicate of duplicates) {
      await mergeCategories(duplicate.id, keep.id, database);
      removed++;
    }
  }
  return removed;
}

/** Donne l'origine « par défaut » aux catégories qui en ont une sans la porter encore (une seule fois). */
export async function backfillCategoryOrigins(database: AppDatabase = defaultDb): Promise<number> {
  const updates = originBackfill(await database.categories.toArray());
  if (updates.length === 0) return 0;
  await database.transaction("rw", database.categories, async () => {
    for (const update of updates) {
      await database.categories.update(update.id, { origin: update.origin });
    }
  });
  return updates.length;
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
