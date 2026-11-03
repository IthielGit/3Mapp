import Dexie, { type Table } from "dexie";
import type {
  Attachment,
  Budget,
  Category,
  Currency,
  Debt,
  DebtPayment,
  ExchangeRate,
  Goal,
  GoalTransaction,
  Recurring,
  Settings,
  Subcategory,
  Template,
  Transaction,
  Wallet,
} from "./entities";

export const DB_NAME = "money-manager";

/**
 * Base IndexedDB (SPEC §4).
 *
 * Chaque évolution du schéma ajoute une version : on ne modifie jamais une version publiée.
 * Version 1 = schéma initial complet.
 */
export class AppDatabase extends Dexie {
  declare settings: Table<Settings, string>;
  declare currencies: Table<Currency, string>;
  declare exchangeRates: Table<ExchangeRate, string>;
  declare wallets: Table<Wallet, string>;
  declare categories: Table<Category, string>;
  declare subcategories: Table<Subcategory, string>;
  declare transactions: Table<Transaction, string>;
  declare templates: Table<Template, string>;
  declare recurring: Table<Recurring, string>;
  declare budgets: Table<Budget, string>;
  declare goals: Table<Goal, string>;
  declare goalTransactions: Table<GoalTransaction, string>;
  declare debts: Table<Debt, string>;
  declare debtPayments: Table<DebtPayment, string>;
  declare attachments: Table<Attachment, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(1).stores({
      settings: "id",
      currencies: "id, code",
      exchangeRates: "id, [from+to+date]",
      wallets: "id, sortOrder",
      categories: "id, kind, sortOrder",
      subcategories: "id, categoryId",
      transactions:
        "id, date, status, [walletId+date], [categoryId+date], recurringId, debtId, goalId",
      templates: "id",
      recurring: "id, nextDate, paused",
      budgets: "id",
      goals: "id",
      goalTransactions: "id, goalId",
      debts: "id, direction",
      debtPayments: "id, debtId",
      attachments: "id",
    });
  }
}

export const db = new AppDatabase();
