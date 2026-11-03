import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { RuleError } from "../../src/db/errors";
import { walletBalance } from "../../src/domain/balance";
import { createCategory } from "../../src/features/categories/category-service";
import {
  bulkUpdate,
  createTransaction,
  duplicateTransaction,
  removeTransactions,
  restoreTransactions,
  updateTransaction,
  type TransactionDraft,
} from "../../src/features/transactions/transaction-service";
import { createWallet } from "../../src/features/wallets/wallet-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

const base = {
  attachmentIds: [] as string[],
  memo: "",
  status: "posted" as const,
};

function draft(
  partial: Partial<TransactionDraft> & Pick<TransactionDraft, "type" | "amount" | "walletId">,
): TransactionDraft {
  return { date: new Date(2026, 0, 15, 10).toISOString(), ...base, ...partial };
}

async function setup() {
  const bank = await createWallet(
    {
      name: "Banque",
      icon: "🏦",
      color: "#000000",
      group: "bank",
      currency: "MGA",
      initialBalance: 100000,
      includeInTotal: true,
      archived: false,
    },
    db,
  );
  const cash = await createWallet(
    {
      name: "Espèces",
      icon: "💵",
      color: "#000000",
      group: "cash",
      currency: "MGA",
      initialBalance: 0,
      includeInTotal: true,
      archived: false,
    },
    db,
  );
  const eur = await createWallet(
    {
      name: "Compte EUR",
      icon: "💶",
      color: "#000000",
      group: "bank",
      currency: "EUR",
      initialBalance: 0,
      includeInTotal: true,
      archived: false,
    },
    db,
  );
  const food = await createCategory(
    { name: "Alimentation", kind: "expense", icon: "🍽️", color: "#000000", archived: false },
    db,
  );
  const salary = await createCategory(
    { name: "Salaire", kind: "income", icon: "💼", color: "#000000", archived: false },
    db,
  );
  return { bank, cash, eur, food, salary };
}

describe("création et validation des transactions", () => {
  it("une dépense met à jour le solde du portefeuille", async () => {
    const { bank, food } = await setup();
    await createTransaction(
      draft({ type: "expense", amount: 15000, walletId: bank.id, categoryId: food.id }),
      db,
    );
    const txs = await db.transactions.toArray();
    expect(walletBalance(bank, txs)).toBe(85000);
  });

  it("un virement entre portefeuilles de même devise ne change pas la somme des soldes", async () => {
    const { bank, cash } = await setup();
    await createTransaction(
      draft({ type: "transfer", amount: 30000, walletId: bank.id, toWalletId: cash.id }),
      db,
    );
    const txs = await db.transactions.toArray();
    const total = walletBalance(bank, txs) + walletBalance(cash, txs);
    expect(total).toBe(100000);
    expect(walletBalance(cash, txs)).toBe(30000);
  });

  it("virement entre devises : montant reçu obligatoire", async () => {
    const { bank, eur } = await setup();
    await expect(
      createTransaction(
        draft({ type: "transfer", amount: 100000, walletId: bank.id, toWalletId: eur.id }),
        db,
      ),
    ).rejects.toBeInstanceOf(RuleError);

    await createTransaction(
      draft({
        type: "transfer",
        amount: 100000,
        toAmount: 2300,
        walletId: bank.id,
        toWalletId: eur.id,
      }),
      db,
    );
    const txs = await db.transactions.toArray();
    expect(walletBalance(eur, txs)).toBe(2300);
  });

  it("virement vers le même portefeuille refusé", async () => {
    const { bank } = await setup();
    await expect(
      createTransaction(
        draft({ type: "transfer", amount: 1000, walletId: bank.id, toWalletId: bank.id }),
        db,
      ),
    ).rejects.toThrow();
  });

  it("une catégorie de revenu ne peut pas servir à une dépense", async () => {
    const { bank, salary } = await setup();
    await expect(
      createTransaction(
        draft({ type: "expense", amount: 1000, walletId: bank.id, categoryId: salary.id }),
        db,
      ),
    ).rejects.toThrow();
  });

  it("un portefeuille archivé ne reçoit pas de nouvelle transaction", async () => {
    const { bank, cash } = await setup();
    await db.wallets.update(cash.id, { archived: true });
    await expect(
      createTransaction(draft({ type: "income", amount: 1000, walletId: cash.id }), db),
    ).rejects.toThrow();
    await expect(
      createTransaction(
        draft({ type: "transfer", amount: 1000, walletId: bank.id, toWalletId: cash.id }),
        db,
      ),
    ).rejects.toThrow();
  });

  it("un ajustement négatif est accepté, une dépense négative refusée", async () => {
    const { bank } = await setup();
    await createTransaction(draft({ type: "adjustment", amount: -2000, walletId: bank.id }), db);
    await expect(
      createTransaction(draft({ type: "expense", amount: -2000, walletId: bank.id }), db),
    ).rejects.toThrow();
  });
});

describe("modification, suppression et annulation", () => {
  it("modifier un virement en effaçant la destination est refusé", async () => {
    const { bank, cash } = await setup();
    const tx = await createTransaction(
      draft({ type: "transfer", amount: 1000, walletId: bank.id, toWalletId: cash.id }),
      db,
    );
    await expect(
      updateTransaction(tx.id, draft({ type: "transfer", amount: 1000, walletId: bank.id }), db),
    ).rejects.toThrow();
  });

  it("suppression puis annulation restaure exactement la transaction", async () => {
    const { bank, food } = await setup();
    const tx = await createTransaction(
      draft({ type: "expense", amount: 5000, walletId: bank.id, categoryId: food.id }),
      db,
    );
    const removed = await removeTransactions([tx.id], db);
    expect(await db.transactions.count()).toBe(0);
    await restoreTransactions(removed, db);
    expect(await db.transactions.get(tx.id)).toEqual(tx);
  });

  it("duplication crée une copie avec un nouvel identifiant", async () => {
    const { bank } = await setup();
    const tx = await createTransaction(
      draft({ type: "income", amount: 9000, walletId: bank.id }),
      db,
    );
    const copy = await duplicateTransaction(tx.id, db);
    expect(copy.id).not.toBe(tx.id);
    expect(copy.amount).toBe(9000);
    expect(await db.transactions.count()).toBe(2);
  });

  it("modification groupée atomique : une seule invalidité annule tout", async () => {
    const { bank, food, salary } = await setup();
    const a = await createTransaction(
      draft({ type: "expense", amount: 1000, walletId: bank.id, categoryId: food.id }),
      db,
    );
    const b = await createTransaction(
      draft({ type: "income", amount: 2000, walletId: bank.id, categoryId: salary.id }),
      db,
    );

    // Passer les deux transactions dans la catégorie « Alimentation » échoue pour le revenu.
    await expect(
      bulkUpdate([a.id, b.id], (d) => ({ ...d, categoryId: food.id }), db),
    ).rejects.toThrow();
    expect((await db.transactions.get(a.id))?.categoryId).toBe(food.id);
    expect((await db.transactions.get(b.id))?.categoryId).toBe(salary.id);
  });
});
