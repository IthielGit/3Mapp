import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import {
  transactionSchema,
  type DebtPayment,
  type GoalTransaction,
  type Transaction,
} from "../../db/entities";
import { createRepository } from "../../db/repositories";
import type { CurrencyCode, Minor } from "../../lib/money";

/** Ce que l'utilisateur saisit. La devise vient du portefeuille source. */
export interface TransactionDraft {
  type: Transaction["type"];
  amount: Minor;
  walletId: string;
  toWalletId?: string | undefined;
  toAmount?: Minor | undefined;
  fee?: Minor | undefined;
  categoryId?: string | undefined;
  subcategoryId?: string | undefined;
  memo: string;
  note?: string | undefined;
  attachmentIds: string[];
  date: string;
  status: Transaction["status"];
}

type TxRecord = Omit<Transaction, "id" | "createdAt" | "updatedAt" | "archived">;

export function draftFromTransaction(t: Transaction): TransactionDraft {
  return {
    type: t.type,
    amount: t.amount,
    walletId: t.walletId,
    toWalletId: t.toWalletId,
    toAmount: t.toAmount,
    fee: t.fee,
    categoryId: t.categoryId,
    subcategoryId: t.subcategoryId,
    memo: t.memo,
    note: t.note,
    attachmentIds: t.attachmentIds,
    date: t.date,
    status: t.status,
  };
}

/**
 * Vérifie les règles métier avant écriture (SPEC §5.4, §6) et retourne l'enregistrement complet.
 * Les champs non applicables sont explicitement mis à undefined, pour qu'une mise à jour les efface.
 */
export async function validateDraft(
  draft: TransactionDraft,
  database: AppDatabase = defaultDb,
  options: { isNew: boolean } = { isNew: true },
): Promise<TxRecord> {
  const wallet = await database.wallets.get(draft.walletId);
  if (!wallet) throw new RuleError("Portefeuille introuvable");
  if (options.isNew && wallet.archived) throw new RuleError("Portefeuille archivé");

  let toWalletId: string | undefined;
  let toAmount: Minor | undefined;
  let fee: Minor | undefined;
  let categoryId: string | undefined;
  let subcategoryId: string | undefined;

  if (draft.type === "transfer") {
    if (!draft.toWalletId) throw new RuleError("Choisissez le portefeuille de destination");
    if (draft.toWalletId === draft.walletId) {
      throw new RuleError("Le virement doit aller vers un autre portefeuille");
    }
    const target = await database.wallets.get(draft.toWalletId);
    if (!target) throw new RuleError("Portefeuille de destination introuvable");
    if (options.isNew && target.archived) throw new RuleError("Portefeuille archivé");
    toWalletId = target.id;
    if (target.currency !== wallet.currency) {
      if (draft.toAmount === undefined) {
        throw new RuleError("Indiquez le montant reçu dans la devise de destination");
      }
      toAmount = draft.toAmount;
    }
    fee = draft.fee && draft.fee > 0 ? draft.fee : undefined;
  } else if (draft.type === "expense" || draft.type === "income") {
    if (draft.categoryId) {
      const category = await database.categories.get(draft.categoryId);
      if (!category) throw new RuleError("Catégorie introuvable");
      const expected = draft.type === "expense" ? "expense" : "income";
      if (category.kind !== expected) throw new RuleError("Catégorie incompatible avec le type");
      categoryId = category.id;
    }
    if (draft.subcategoryId) {
      const sub = await database.subcategories.get(draft.subcategoryId);
      if (!sub || sub.categoryId !== categoryId) {
        throw new RuleError("Sous-catégorie incompatible avec la catégorie");
      }
      subcategoryId = sub.id;
    }
  }

  const record: TxRecord = {
    type: draft.type,
    amount: draft.amount,
    currency: wallet.currency as CurrencyCode,
    walletId: wallet.id,
    toWalletId,
    toAmount,
    fee,
    categoryId,
    subcategoryId,
    memo: draft.memo.trim(),
    note: draft.note?.trim() || undefined,
    attachmentIds: draft.attachmentIds,
    date: draft.date,
    status: draft.status,
    recurringId: undefined,
    debtId: undefined,
    goalId: undefined,
  };

  const parsed = transactionSchema.safeParse({
    ...record,
    id: "00000000-0000-4000-8000-000000000000",
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
  });
  if (!parsed.success) {
    throw new RuleError(parsed.error.issues[0]?.message ?? "Transaction invalide");
  }
  return record;
}

function repo(database: AppDatabase) {
  return createRepository(database.transactions, transactionSchema);
}

export async function createTransaction(
  draft: TransactionDraft,
  database: AppDatabase = defaultDb,
): Promise<Transaction> {
  const record = await validateDraft(draft, database, { isNew: true });
  return repo(database).create(record);
}

export async function updateTransaction(
  id: string,
  draft: TransactionDraft,
  database: AppDatabase = defaultDb,
): Promise<Transaction> {
  const record = await validateDraft(draft, database, { isNew: false });
  return repo(database).update(id, record);
}

export interface RemovedBundle {
  transactions: Transaction[];
  goalTransactions: GoalTransaction[];
  debtPayments: DebtPayment[];
}

/**
 * Supprime des transactions et les liaisons qui pointent vers elles (versements d'objectif, paiements de dette).
 * Retourne tout ce qui a été supprimé, pour permettre l'annulation.
 */
export async function removeTransactions(
  ids: readonly string[],
  database: AppDatabase = defaultDb,
): Promise<RemovedBundle> {
  return database.transaction(
    "rw",
    [database.transactions, database.goalTransactions, database.debtPayments],
    async () => {
      const bundle: RemovedBundle = { transactions: [], goalTransactions: [], debtPayments: [] };
      for (const id of ids) {
        const existing = await database.transactions.get(id);
        if (!existing) continue;
        bundle.transactions.push(existing);
        bundle.goalTransactions.push(
          ...(await database.goalTransactions.filter((g) => g.transactionId === id).toArray()),
        );
        bundle.debtPayments.push(
          ...(await database.debtPayments.filter((p) => p.transactionId === id).toArray()),
        );
      }
      await database.goalTransactions.bulkDelete(bundle.goalTransactions.map((g) => g.id));
      await database.debtPayments.bulkDelete(bundle.debtPayments.map((p) => p.id));
      await database.transactions.bulkDelete(bundle.transactions.map((t) => t.id));
      return bundle;
    },
  );
}

/** Annulation d'une suppression : réinsère exactement ce qui avait été retiré. */
export async function restoreTransactions(
  bundle: RemovedBundle,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.transaction(
    "rw",
    [database.transactions, database.goalTransactions, database.debtPayments],
    async () => {
      await database.transactions.bulkPut(bundle.transactions);
      await database.goalTransactions.bulkPut(bundle.goalTransactions);
      await database.debtPayments.bulkPut(bundle.debtPayments);
    },
  );
}

export async function duplicateTransaction(
  id: string,
  database: AppDatabase = defaultDb,
): Promise<Transaction> {
  const original = await database.transactions.get(id);
  if (!original) throw new RuleError("Transaction introuvable");
  const draft = {
    ...draftFromTransaction(original),
    date: new Date().toISOString(),
    status: "posted" as const,
  };
  return createTransaction(draft, database);
}

/**
 * Applique une modification à plusieurs transactions, de façon atomique : si une seule est invalide,
 * rien n'est modifié.
 */
export async function bulkUpdate(
  ids: readonly string[],
  change: (draft: TransactionDraft) => TransactionDraft,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.transaction(
    "rw",
    [database.transactions, database.wallets, database.categories, database.subcategories],
    async () => {
      for (const id of ids) {
        const existing = await database.transactions.get(id);
        if (!existing) continue;
        const next = change(draftFromTransaction(existing));
        await updateTransaction(id, next, database);
      }
    },
  );
}
