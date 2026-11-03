import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { transactionSchema, walletSchema } from "../../src/db/entities";
import { createRepository } from "../../src/db/repositories";

const EXPECTED_TABLES = [
  "settings",
  "currencies",
  "exchangeRates",
  "wallets",
  "categories",
  "subcategories",
  "transactions",
  "templates",
  "recurring",
  "budgets",
  "goals",
  "goalTransactions",
  "debts",
  "debtPayments",
  "attachments",
  "reconciliations",
].sort();

let testDb: AppDatabase;

beforeEach(() => {
  testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await testDb.delete();
});

describe("schéma Dexie", () => {
  it("contient toutes les tables de SPEC §4", async () => {
    await testDb.open();
    expect(testDb.tables.map((t) => t.name).sort()).toEqual(EXPECTED_TABLES);
  });
});

describe("repository wallets", () => {
  it("crée, relit et met à jour un portefeuille", async () => {
    const wallets = createRepository(testDb.wallets, walletSchema);

    const created = await wallets.create({
      name: "Banque",
      icon: "bank",
      color: "#0f766e",
      currency: "MGA",
      initialBalance: 150000,
      sortOrder: 0,
      includeInTotal: true,
      group: "bank",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

    const read = await wallets.get(created.id);
    expect(read).toEqual(created);

    const updated = await wallets.update(created.id, { name: "BNI" });
    expect(updated.name).toBe("BNI");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.initialBalance).toBe(150000);

    expect(await wallets.list()).toHaveLength(1);
    await wallets.remove(created.id);
    expect(await wallets.get(created.id)).toBeUndefined();
  });

  it("refuse un solde initial flottant", async () => {
    const wallets = createRepository(testDb.wallets, walletSchema);
    await expect(
      wallets.create({
        name: "Espèces",
        icon: "cash",
        color: "#000000",
        currency: "EUR",
        initialBalance: 10.5,
        sortOrder: 1,
        includeInTotal: true,
        group: "cash",
      }),
    ).rejects.toThrow();
    expect(await testDb.wallets.count()).toBe(0);
  });
});

describe("règles de transaction (SPEC §4, §6)", () => {
  const base = {
    id: crypto.randomUUID(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    currency: "MGA",
    walletId: crypto.randomUUID(),
    memo: "",
    attachmentIds: [],
    date: "2026-01-02T10:00:00.000Z",
    status: "posted",
  } as const;

  it("un virement exige une destination différente", () => {
    const noDest = transactionSchema.safeParse({ ...base, type: "transfer", amount: 1000 });
    expect(noDest.success).toBe(false);

    const sameWallet = transactionSchema.safeParse({
      ...base,
      type: "transfer",
      amount: 1000,
      toWalletId: base.walletId,
    });
    expect(sameWallet.success).toBe(false);

    const ok = transactionSchema.safeParse({
      ...base,
      type: "transfer",
      amount: 1000,
      toWalletId: crypto.randomUUID(),
    });
    expect(ok.success).toBe(true);
  });

  it("une dépense ne peut pas avoir un montant négatif", () => {
    expect(transactionSchema.safeParse({ ...base, type: "expense", amount: -500 }).success).toBe(
      false,
    );
  });

  it("un ajustement peut être négatif", () => {
    expect(transactionSchema.safeParse({ ...base, type: "adjustment", amount: -500 }).success).toBe(
      true,
    );
  });
});
