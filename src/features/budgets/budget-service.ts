import { db as defaultDb, type AppDatabase } from "../../db/database";
import { budgetSchema, type Budget } from "../../db/entities";
import { createRepository } from "../../db/repositories";
import type { CurrencyCode } from "../../lib/money";

export interface BudgetInput {
  name: string;
  amount: number;
  currency: CurrencyCode;
  period: Budget["period"];
  startDate: string;
  endDate?: string | undefined;
  categoryIds: string[];
  walletIds: string[];
  rollover: boolean;
  alertThreshold: number;
}

function repo(database: AppDatabase) {
  return createRepository(database.budgets, budgetSchema);
}

export async function createBudget(
  input: BudgetInput,
  database: AppDatabase = defaultDb,
): Promise<Budget> {
  return repo(database).create({ ...input, endDate: input.endDate || undefined, archived: false });
}

export async function updateBudget(
  id: string,
  input: BudgetInput,
  database: AppDatabase = defaultDb,
): Promise<Budget> {
  return repo(database).update(id, { ...input, endDate: input.endDate || undefined });
}

export async function deleteBudget(id: string, database: AppDatabase = defaultDb): Promise<void> {
  await repo(database).remove(id);
}
