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
  Reconciliation,
  Settings,
  Subcategory,
  Template,
  Transaction,
  Wallet,
} from "./entities";
import { installSyncTracking, type OutboxEntry, type SyncStateRow } from "./sync-tracking";

export const DB_NAME = "money-manager";

/**
 * Base IndexedDB (SPEC §4).
 *
 * Chaque évolution du schéma ajoute une version : on ne modifie jamais une version publiée.
 * Version 1 = schéma initial complet ; version 2 = réconciliations.
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
  declare reconciliations: Table<Reconciliation, string>;
  /** File des modifications à envoyer (phase C, synchronisation). */
  declare syncOutbox: Table<OutboxEntry, string>;
  /** État de la synchronisation sur cet appareil. */
  declare syncState: Table<SyncStateRow, string>;

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

    // Version 2 : historique des réconciliations (SPEC §5.12). Ajout de table, données existantes conservées.
    this.version(2).stores({
      reconciliations: "id, walletId",
    });

    // Version 3 : aucune structure ne change. Les transactions déjà liées à un objectif ou à une dette
    // reçoivent la marque correspondante, pour ne plus être comptées comme dépenses ou revenus.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const goalRows = (await tx.table("goalTransactions").toArray()) as GoalTransaction[];
        for (const row of goalRows) {
          if (row.transactionId) await tx.table("transactions").update(row.transactionId, { goalId: row.goalId });
        }
        const paymentRows = (await tx.table("debtPayments").toArray()) as DebtPayment[];
        for (const row of paymentRows) {
          if (row.transactionId) await tx.table("transactions").update(row.transactionId, { debtId: row.debtId });
        }
      });

    // Version 4 : file d'envoi et état de synchronisation (plan « comptes », phase C). Ajout de tables seulement.
    this.version(4).stores({
      syncOutbox: "key, seq",
      syncState: "id",
    });

    installSyncTracking(this);
  }
}

export const db = new AppDatabase();
