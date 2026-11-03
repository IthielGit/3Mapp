import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { debtState } from "../../src/domain/debts";
import { goalBalance } from "../../src/domain/goals";
import {
  addDebtPayment,
  addGoalMovement,
  createDebt,
  createGoal,
} from "../../src/features/goals-debts/goals-debts-service";
import {
  removeTransactions,
  restoreTransactions,
} from "../../src/features/transactions/transaction-service";
import { createWallet } from "../../src/features/wallets/wallet-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

const NOW = new Date(2026, 5, 1, 12);

describe("paiements de dette liés à une transaction", () => {
  it("reste dû exact après plusieurs paiements, avec transactions réelles", async () => {
    const wallet = await createWallet(
      {
        name: "Banque",
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 0,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    const debt = await createDebt(
      {
        direction: "borrowed",
        counterparty: "Tante",
        principal: 1000000,
        currency: "MGA",
        startDate: new Date(2026, 0, 1).toISOString(),
        notes: "",
      },
      db,
    );
    await addDebtPayment(
      debt.id,
      300000,
      new Date(2026, 1, 1).toISOString(),
      "Premier",
      wallet.id,
      db,
    );
    await addDebtPayment(
      debt.id,
      150000,
      new Date(2026, 2, 1).toISOString(),
      "Deuxième",
      wallet.id,
      db,
    );

    const payments = await db.debtPayments.toArray();
    expect(debtState(debt, payments, NOW).remaining).toBe(550000);
    expect(await db.transactions.count()).toBe(2);
  });

  it("supprimer la transaction d’un paiement retire le paiement, et l’annulation le restaure", async () => {
    const wallet = await createWallet(
      {
        name: "Banque",
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 0,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    const debt = await createDebt(
      {
        direction: "borrowed",
        counterparty: "Tante",
        principal: 1000000,
        currency: "MGA",
        startDate: new Date(2026, 0, 1).toISOString(),
        notes: "",
      },
      db,
    );
    await addDebtPayment(
      debt.id,
      300000,
      new Date(2026, 1, 1).toISOString(),
      "Premier",
      wallet.id,
      db,
    );
    const linkedTx = (await db.transactions.toArray())[0];
    expect(linkedTx).toBeDefined();

    const removed = await removeTransactions([linkedTx?.id ?? ""], db);
    expect(removed.debtPayments).toHaveLength(1);
    expect(debtState(debt, await db.debtPayments.toArray(), NOW).remaining).toBe(1000000);

    await restoreTransactions(removed, db);
    expect(debtState(debt, await db.debtPayments.toArray(), NOW).remaining).toBe(700000);
  });
});

describe("versements d’objectif liés à une transaction", () => {
  it("versement lié : une dépense est créée et le montant épargné suit", async () => {
    const wallet = await createWallet(
      {
        name: "Banque",
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 500000,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    const goal = await createGoal(
      { name: "Moto", icon: "🏍️", targetAmount: 800000, currency: "MGA" },
      db,
    );
    await addGoalMovement(
      goal.id,
      200000,
      new Date(2026, 0, 5).toISOString(),
      "Versement",
      wallet.id,
      db,
    );
    await addGoalMovement(
      goal.id,
      -50000,
      new Date(2026, 0, 9).toISOString(),
      "Retrait",
      undefined,
      db,
    );

    expect(goalBalance(await db.goalTransactions.toArray())).toBe(150000);
    expect(await db.transactions.count()).toBe(1); // seul le versement lié crée une transaction
  });
});
