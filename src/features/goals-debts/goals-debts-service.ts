import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import {
  debtPaymentSchema,
  debtSchema,
  goalSchema,
  goalTransactionSchema,
  type Debt,
  type Goal,
} from "../../db/entities";
import { createRepository } from "../../db/repositories";
import type { CurrencyCode, Minor } from "../../lib/money";
import { createTransaction } from "../transactions/transaction-service";

/* ---------- Objectifs d’épargne ---------- */

export interface GoalInput {
  name: string;
  icon: string;
  targetAmount: Minor;
  currency: CurrencyCode;
  targetDate?: string | undefined;
  walletId?: string | undefined;
}

export async function createGoal(
  input: GoalInput,
  database: AppDatabase = defaultDb,
): Promise<Goal> {
  return createRepository(database.goals, goalSchema).create({ ...input, archived: false });
}

/**
 * Versement (positif) ou retrait (négatif). Si `linkWalletId` est fourni, une transaction réelle est créée
 * dans ce portefeuille (dépense pour un versement, revenu pour un retrait) et liée au mouvement.
 */
export async function addGoalMovement(
  goalId: string,
  amount: Minor,
  date: string,
  memo: string,
  linkWalletId?: string | undefined,
  database: AppDatabase = defaultDb,
): Promise<void> {
  if (amount === 0) throw new RuleError("Montant nul");
  const goal = await database.goals.get(goalId);
  if (!goal) throw new RuleError("Objectif introuvable");

  let transactionId: string | undefined;
  if (linkWalletId) {
    const tx = await createTransaction(
      {
        type: amount > 0 ? "expense" : "income",
        amount: Math.abs(amount),
        walletId: linkWalletId,
        memo: memo || goal.name,
        attachmentIds: [],
        date,
        status: "posted",
      },
      database,
    );
    transactionId = tx.id;
    // Marque : ce mouvement est un versement d’objectif, pas une dépense ni un revenu.
    await database.transactions.update(tx.id, { goalId });
  }

  const now = new Date().toISOString();
  const row = goalTransactionSchema.parse({
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    goalId,
    amount,
    date,
    memo,
    transactionId,
  });
  await database.goalTransactions.add(row);
}

export async function deleteGoal(id: string, database: AppDatabase = defaultDb): Promise<void> {
  await database.transaction("rw", [database.goals, database.goalTransactions], async () => {
    await database.goalTransactions.where("goalId").equals(id).delete();
    await database.goals.delete(id);
  });
}

export async function setGoalArchived(
  id: string,
  archived: boolean,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.goals.update(id, { archived, updatedAt: new Date().toISOString() });
}

/* ---------- Dettes et prêts ---------- */

export interface DebtInputFields {
  direction: Debt["direction"];
  counterparty: string;
  principal: Minor;
  currency: CurrencyCode;
  startDate: string;
  dueDate?: string | undefined;
  interestRate?: number | undefined;
  notes: string;
}

export async function createDebt(
  input: DebtInputFields,
  database: AppDatabase = defaultDb,
): Promise<Debt> {
  if (input.counterparty.trim() === "") throw new RuleError("Nom de la contrepartie requis");
  const now = new Date().toISOString();
  const parsed = debtSchema.safeParse({
    ...input,
    counterparty: input.counterparty.trim(),
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    archived: false,
  });
  if (!parsed.success) throw new RuleError(parsed.error.issues[0]?.message ?? "Dette invalide");
  await database.debts.add(parsed.data);
  return parsed.data;
}

/**
 * Paiement partiel. Si `linkWalletId` est fourni, une transaction réelle est créée :
 * dépense si on rembourse une dette, revenu si on reçoit un remboursement.
 */
export async function addDebtPayment(
  debtId: string,
  amount: Minor,
  date: string,
  memo: string,
  linkWalletId?: string | undefined,
  database: AppDatabase = defaultDb,
): Promise<void> {
  const debt = await database.debts.get(debtId);
  if (!debt) throw new RuleError("Dette introuvable");

  let transactionId: string | undefined;
  if (linkWalletId) {
    const tx = await createTransaction(
      {
        type: debt.direction === "borrowed" ? "expense" : "income",
        amount,
        walletId: linkWalletId,
        memo: memo || debt.counterparty,
        attachmentIds: [],
        date,
        status: "posted",
      },
      database,
    );
    transactionId = tx.id;
    // Marque : ce mouvement est un remboursement, pas une dépense ni un revenu.
    await database.transactions.update(tx.id, { debtId });
  }

  const now = new Date().toISOString();
  const parsed = debtPaymentSchema.safeParse({
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    debtId,
    amount,
    date,
    memo,
    transactionId,
  });
  if (!parsed.success) throw new RuleError(parsed.error.issues[0]?.message ?? "Paiement invalide");
  await database.debtPayments.add(parsed.data);
}

export async function deleteDebt(id: string, database: AppDatabase = defaultDb): Promise<void> {
  await database.transaction("rw", [database.debts, database.debtPayments], async () => {
    await database.debtPayments.where("debtId").equals(id).delete();
    await database.debts.delete(id);
  });
}
