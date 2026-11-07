import Dexie from "dexie";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { InUseError, RuleError } from "../../db/errors";
import {
  categorySchema,
  subcategorySchema,
  type Category,
  type Subcategory,
} from "../../db/entities";
import { createRepository } from "../../db/repositories";
import {
  canonicalMerges,
  defaultCategoryId,
  defaultKeyOf,
  defaultOrigin,
  defaultsToEnsure,
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

/** Transactions d'une catégorie, par l'index [categoryId+date] (pas de parcours de toute la table). */
function transactionsOf(database: AppDatabase, categoryId: string) {
  return database.transactions
    .where("[categoryId+date]")
    .between([categoryId, Dexie.minKey], [categoryId, Dexie.maxKey]);
}

/** Vrai si la catégorie est référencée par une transaction, une récurrence ou un budget. */
export async function isCategoryUsed(
  categoryId: string,
  database: AppDatabase = defaultDb,
): Promise<boolean> {
  if ((await transactionsOf(database, categoryId).count()) > 0) return true;

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

/** Ajoute des clés à la liste des catégories par défaut masquées (à appeler dans une transaction sur les réglages). */
async function hideDefaultKeys(keys: readonly string[], database: AppDatabase): Promise<void> {
  if (keys.length === 0) return;
  const settings = await database.settings.toCollection().first();
  if (!settings) return;
  const hidden = new Set(settings.hiddenDefaultCategories ?? []);
  const before = hidden.size;
  for (const key of keys) hidden.add(key);
  if (hidden.size === before) return;
  await database.settings.update(settings.id, { hiddenDefaultCategories: [...hidden].sort() });
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
  if (categories.length === 0) return 0;
  const existing = await database.categories.toArray();
  const nextOrder = new Map<DefaultCategory["kind"], number>();
  for (const c of existing) nextOrder.set(c.kind, Math.max(nextOrder.get(c.kind) ?? 0, c.sortOrder + 1));
  let inserted = 0;
  for (const category of categories) {
    const id = defaultCategoryId(category.kind, category.name);
    if (await database.categories.get(id)) continue;
    const sortOrder = nextOrder.get(category.kind) ?? 0;
    nextOrder.set(category.kind, sortOrder + 1);
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
 * Bouton « Restaurer les catégories par défaut » et onboarding : ajoute toutes celles qui manquent (jamais de
 * doublon, rien n'est modifié ni supprimé) et oublie les suppressions faites par l'utilisateur.
 * La liste des manquantes est calculée dans la transaction, pour qu'un appel concurrent ne double rien.
 * Retourne le nombre de catégories ajoutées.
 */
export async function restoreDefaultCategories(database: AppDatabase = defaultDb): Promise<number> {
  let added = 0;
  await database.transaction("rw", database.categories, database.settings, async () => {
    const settings = await database.settings.toCollection().first();
    if (settings?.hiddenDefaultCategories?.length) {
      await database.settings.update(settings.id, { hiddenDefaultCategories: [] });
    }
    const missing = missingDefaultCategories(await database.categories.toArray());
    added = await insertDefaultCategories(missing, database);
  });
  return added;
}

/**
 * Après chaque synchro : recrée les catégories par défaut absentes que l'utilisateur n'a pas supprimées.
 * Une catégorie perdue autrement (ancienne version de l'app, synchro) revient donc d'elle-même ; sa date de
 * modification, plus récente que la suppression enregistrée sur le serveur, la fait revenir partout.
 * Sans réglages locaux (compte pas encore initialisé), rien n'est fait : l'onboarding s'en charge.
 * Retourne le nombre de catégories ajoutées.
 */
export async function ensureDefaultCategories(database: AppDatabase = defaultDb): Promise<number> {
  if (!(await database.settings.toCollection().first())) return 0;
  await backfillCategoryOrigins(database);
  let added = 0;
  await database.transaction("rw", database.categories, database.settings, async () => {
    const settings = await database.settings.toCollection().first();
    if (!settings) return;
    const toAdd = defaultsToEnsure(await database.categories.toArray(), settings.hiddenDefaultCategories ?? []);
    added = await insertDefaultCategories(toAdd, database);
  });
  return added;
}

/** Tables touchées par le déplacement des références d'une catégorie. */
function mergeTables(database: AppDatabase) {
  return [
    database.categories,
    database.subcategories,
    database.transactions,
    database.budgets,
    database.recurring,
    database.settings,
  ];
}

/** Déplace toutes les références de `fromId` vers `intoId`, puis supprime `fromId`. Dans une transaction. */
async function moveReferencesAndDelete(fromId: string, intoId: string, database: AppDatabase): Promise<void> {
  await transactionsOf(database, fromId).modify((t) => {
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
  const settings = await database.settings.toCollection().first();
  if (settings?.payIncomeCategoryId === fromId) {
    await database.settings.update(settings.id, { payIncomeCategoryId: intoId });
  }
  await database.categories.delete(fromId);
}

/**
 * Fusionne les copies de chaque catégorie par défaut (même nature, même nom) dans sa ligne à identifiant stable,
 * créée au besoin. Les références sont déplacées. La ligne stable n'est jamais supprimée : deux appareils qui
 * voient des lignes différentes convergent quand même vers la même catégorie, sans rien perdre.
 * Retourne le nombre de copies fusionnées.
 */
export async function canonicalizeDefaultCategories(database: AppDatabase = defaultDb): Promise<number> {
  const merges = canonicalMerges(await database.categories.toArray());
  let merged = 0;
  for (const merge of merges) {
    await database.transaction("rw", mergeTables(database), async () => {
      // Relu dans la transaction : un autre appel a pu faire la fusion entre-temps.
      const copies = (await database.categories.bulkGet(merge.copies.map((c) => c.id))).filter(
        (c): c is Category => c !== undefined,
      );
      if (copies.length === 0) return;
      const anyActive = copies.some((c) => !c.archived);
      const stable = await database.categories.get(merge.stableId);
      const template = merge.copies[0];
      if (!stable && template) {
        const now = new Date().toISOString();
        await database.categories.put(
          categorySchema.parse({
            id: merge.stableId,
            name: template.name,
            kind: template.kind,
            icon: template.icon,
            color: template.color,
            archived: !anyActive,
            origin: merge.key,
            sortOrder: template.sortOrder,
            createdAt: template.createdAt,
            updatedAt: now,
          }),
        );
      } else if (stable?.archived && anyActive) {
        // Une copie visible fusionnée dans une ligne archivée : la catégorie reste visible.
        await categoryRepo(database).update(stable.id, { archived: false });
      }
      for (const copy of copies) {
        await moveReferencesAndDelete(copy.id, merge.stableId, database);
        merged++;
      }
    });
  }
  return merged;
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

/**
 * Suppression par l'utilisateur. Une catégorie par défaut supprimée est mémorisée (réglage synchronisé) :
 * elle n'est plus recréée automatiquement, sauf par le bouton « Restaurer ».
 */
export async function deleteCategory(id: string, database: AppDatabase = defaultDb): Promise<void> {
  if (await isCategoryUsed(id, database)) throw new InUseError("category");
  const subs = await database.subcategories.where("categoryId").equals(id).toArray();
  for (const sub of subs) {
    if (await isSubcategoryUsed(sub.id, database)) throw new InUseError("subcategory");
  }
  await database.transaction(
    "rw",
    [database.categories, database.subcategories, database.settings],
    async () => {
      const category = await database.categories.get(id);
      const key = category ? defaultKeyOf(category) : undefined;
      if (key) await hideDefaultKeys([key], database);
      await database.subcategories.where("categoryId").equals(id).delete();
      await database.categories.delete(id);
    },
  );
}

/**
 * Fusion demandée par l'utilisateur : toutes les références de `fromId` vont vers `intoId`, puis `fromId`
 * est supprimée. Si `fromId` était une catégorie par défaut, elle est mémorisée comme supprimée.
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

  await database.transaction("rw", mergeTables(database), async () => {
    const key = defaultKeyOf(from);
    if (key && key !== defaultKeyOf(into)) await hideDefaultKeys([key], database);
    await moveReferencesAndDelete(fromId, intoId, database);
  });
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
