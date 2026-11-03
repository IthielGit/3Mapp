import type { Table } from "dexie";
import type { z } from "zod";
import { db } from "./database";
import {
  attachmentSchema,
  budgetSchema,
  categorySchema,
  currencySchema,
  debtPaymentSchema,
  debtSchema,
  exchangeRateSchema,
  goalSchema,
  goalTransactionSchema,
  recurringSchema,
  settingsSchema,
  subcategorySchema,
  templateSchema,
  transactionSchema,
  walletSchema,
  type Attachment,
  type Budget,
  type Category,
  type Currency,
  type Debt,
  type DebtPayment,
  type ExchangeRate,
  type Goal,
  type GoalTransaction,
  type Recurring,
  type Settings,
  type Subcategory,
  type Template,
  type Transaction,
  type Wallet,
} from "./entities";

interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean | undefined;
}

type NewRecord<T extends BaseRecord> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Repository générique typé. Chaque écriture est validée par Zod avant d'atteindre IndexedDB,
 * donc un montant flottant ou une référence incohérente ne peut pas être stocké.
 */
export function createRepository<T extends BaseRecord>(
  table: Table<T, string>,
  schema: z.ZodType<T, unknown>,
) {
  const write = async (record: T): Promise<T> => {
    const valid = schema.parse(record);
    await table.put(valid);
    return valid;
  };

  return {
    get: (id: string): Promise<T | undefined> => table.get(id),

    list: (): Promise<T[]> => table.toArray(),

    async create(input: NewRecord<T>): Promise<T> {
      const now = new Date().toISOString();
      const draft = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as T;
      return write(draft);
    },

    async update(id: string, patch: Partial<NewRecord<T>>): Promise<T> {
      const existing = await table.get(id);
      if (!existing) throw new Error(`Enregistrement introuvable : ${id}`);
      return write({
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      } as T);
    },

    remove: (id: string): Promise<void> => table.delete(id),
  };
}

export const repositories = {
  settings: createRepository<Settings>(db.settings, settingsSchema),
  currencies: createRepository<Currency>(db.currencies, currencySchema),
  exchangeRates: createRepository<ExchangeRate>(db.exchangeRates, exchangeRateSchema),
  wallets: createRepository<Wallet>(db.wallets, walletSchema),
  categories: createRepository<Category>(db.categories, categorySchema),
  subcategories: createRepository<Subcategory>(db.subcategories, subcategorySchema),
  transactions: createRepository<Transaction>(db.transactions, transactionSchema),
  templates: createRepository<Template>(db.templates, templateSchema),
  recurring: createRepository<Recurring>(db.recurring, recurringSchema),
  budgets: createRepository<Budget>(db.budgets, budgetSchema),
  goals: createRepository<Goal>(db.goals, goalSchema),
  goalTransactions: createRepository<GoalTransaction>(db.goalTransactions, goalTransactionSchema),
  debts: createRepository<Debt>(db.debts, debtSchema),
  debtPayments: createRepository<DebtPayment>(db.debtPayments, debtPaymentSchema),
  attachments: createRepository<Attachment>(db.attachments, attachmentSchema),
};
