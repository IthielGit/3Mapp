import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { walletBalance } from "../../src/domain/balance";
import { reconcileWallet } from "../../src/features/money/money-services";
import { createCategory } from "../../src/features/categories/category-service";
import { createTransaction } from "../../src/features/transactions/transaction-service";
import { createWallet } from "../../src/features/wallets/wallet-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("réconciliation (SPEC §5.12)", () => {
  it("le solde calculé devient le solde réel saisi, et l’écart est une transaction d’ajustement", async () => {
    const wallet = await createWallet(
      {
        name: "Espèces",
        icon: "💵",
        color: "#000000",
        group: "cash",
        currency: "MGA",
        initialBalance: 100000,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    const food = await createCategory(
      { name: "Alimentation", kind: "expense", icon: "🍽️", color: "#000000", archived: false },
      db,
    );
    await createTransaction(
      {
        type: "expense",
        amount: 30000,
        walletId: wallet.id,
        categoryId: food.id,
        memo: "Course",
        attachmentIds: [],
        date: new Date(2026, 0, 5).toISOString(),
        status: "posted",
      },
      db,
    );
    // Calculé : 70 000. Réel constaté : 62 500.
    const record = await reconcileWallet(wallet.id, 62500, "", new Date(2026, 0, 31), db);
    expect(record.computedBalance).toBe(70000);
    expect(record.adjustment).toBe(-7500);

    const after = walletBalance(wallet, await db.transactions.toArray());
    expect(after).toBe(62500);
    expect(await db.reconciliations.count()).toBe(1);
  });

  it("sans écart : aucune transaction créée, l’historique garde la trace", async () => {
    const wallet = await createWallet(
      {
        name: "Banque",
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 50000,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    await reconcileWallet(wallet.id, 50000, "", new Date(), db);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.reconciliations.count()).toBe(1);
  });
});
