import { db as defaultDb, type AppDatabase } from "../../db/database";
import { InUseError } from "../../db/errors";
import { walletSchema, type Wallet } from "../../db/entities";
import { createRepository } from "../../db/repositories";
import { moveItem, sortOrderChanges } from "../../domain/ordering";

export type WalletInput = Omit<Wallet, "id" | "createdAt" | "updatedAt" | "sortOrder">;

function walletRepo(database: AppDatabase) {
  return createRepository(database.wallets, walletSchema);
}

/** Vrai si un portefeuille est référencé : transaction, récurrence, objectif ou budget. */
export async function isWalletUsed(
  walletId: string,
  database: AppDatabase = defaultDb,
): Promise<boolean> {
  const inTransactions = await database.transactions
    .filter((t) => t.walletId === walletId || t.toWalletId === walletId)
    .first();
  if (inTransactions) return true;

  const inRecurring = await database.recurring
    .filter((r) => r.walletId === walletId || r.toWalletId === walletId)
    .first();
  if (inRecurring) return true;

  const inGoals = await database.goals.filter((g) => g.walletId === walletId).first();
  if (inGoals) return true;

  const inBudgets = await database.budgets.filter((b) => b.walletIds.includes(walletId)).first();
  return inBudgets !== undefined;
}

export async function createWallet(input: WalletInput, database: AppDatabase = defaultDb) {
  const repo = walletRepo(database);
  const existing = await repo.list();
  const sortOrder = existing.reduce((max, w) => Math.max(max, w.sortOrder), -1) + 1;
  return repo.create({ ...input, sortOrder });
}

export async function updateWallet(
  id: string,
  patch: Partial<WalletInput>,
  database: AppDatabase = defaultDb,
) {
  return walletRepo(database).update(id, patch);
}

export async function setWalletArchived(
  id: string,
  archived: boolean,
  database: AppDatabase = defaultDb,
) {
  return walletRepo(database).update(id, { archived });
}

/** Suppression refusée si le portefeuille est utilisé : l'UI propose alors l'archivage. */
export async function deleteWallet(id: string, database: AppDatabase = defaultDb): Promise<void> {
  if (await isWalletUsed(id, database)) throw new InUseError("wallet");
  await walletRepo(database).remove(id);
}

export async function moveWallet(
  id: string,
  direction: -1 | 1,
  database: AppDatabase = defaultDb,
): Promise<void> {
  const repo = walletRepo(database);
  const sorted = (await repo.list()).sort((a, b) => a.sortOrder - b.sortOrder);
  const changes = sortOrderChanges(moveItem(sorted, id, direction));
  for (const change of changes) {
    await repo.update(change.id, { sortOrder: change.sortOrder });
  }
}
