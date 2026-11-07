import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { createDebt } from "../../src/features/goals-debts/goals-debts-service";
import { createCategory } from "../../src/features/categories/category-service";
import { createWallet } from "../../src/features/wallets/wallet-service";
import { AppDatabase } from "../../src/db/database";
import type { Transaction } from "../../src/db/entities";
import { debtState } from "../../src/domain/debts";
import { isEarning, isSpending, totals } from "../../src/domain/totals";

const base = {
  id: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  currency: "MGA" as const,
  walletId: "00000000-0000-4000-8000-0000000000aa",
  memo: "",
  attachmentIds: [],
  status: "posted" as const,
  date: "2026-03-01T10:00:00.000Z",
};

function tx(partial: Partial<Transaction> & Pick<Transaction, "type" | "amount">): Transaction {
  return { ...base, ...partial } as Transaction;
}

describe("versements d'objectif et remboursements de dette", () => {
  it("un versement d'objectif n'est ni une dépense ni un revenu", () => {
    const deposit = tx({ type: "expense", amount: 200, goalId: "00000000-0000-4000-8000-0000000000gg" });
    expect(isSpending(deposit)).toBe(false);
    expect(isEarning(deposit)).toBe(false);
  });

  it("une dépense normale reste une dépense", () => {
    expect(isSpending(tx({ type: "expense", amount: 300 }))).toBe(true);
  });

  it("les totaux excluent objectifs et dettes", () => {
    const t = totals([
      tx({ type: "income", amount: 1000 }),
      tx({ type: "expense", amount: 300 }),
      tx({ type: "expense", amount: 200, goalId: "00000000-0000-4000-8000-0000000000gg" }),
      tx({ type: "expense", amount: 100, debtId: "00000000-0000-4000-8000-0000000000dd" }),
      tx({ type: "income", amount: 50, debtId: "00000000-0000-4000-8000-0000000000dd" }),
    ]);
    expect(t.income).toBe(1000);
    expect(t.expense).toBe(300);
  });
});

describe("intérêts de dette sur le capital restant", () => {
  const loan = {
    principal: 1_000_000,
    interestRate: 12,
    startDate: new Date(2026, 0, 1, 12).toISOString(),
  };

  it("un remboursement réduit la base des intérêts suivants", () => {
    // 181 jours sur 1 000 000 : 59 507. Remboursement de 500 000 : intérêts d'abord, puis capital.
    // Capital restant : 559 507. Ensuite 184 jours : 33 846 d’intérêts. Reste dû : 593 353.
    const s = debtState(loan, [{ amount: 500_000, date: new Date(2026, 6, 1, 12).toISOString() }], new Date(2027, 0, 1, 12));
    expect(s.paid).toBe(500_000);
    expect(s.remaining).toBe(593_353);
    expect(s.totalDue).toBe(1_093_353);
  });

  it("moins d'un jour écoulé : aucun intérêt (pas de dérive à la minute)", () => {
    const s = debtState(loan, [], new Date(2026, 0, 1, 18));
    expect(s.remaining).toBe(1_000_000);
  });
});

describe("migration vers la version 3 de la base", () => {
  it("marque les transactions déjà liées à un objectif ou à une dette", async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(2).stores({
      transactions: "id, date, status, [walletId+date], [categoryId+date], recurringId, debtId, goalId",
      goalTransactions: "id, goalId",
      debtPayments: "id, debtId",
    });
    await legacy.open();
    await legacy.table("transactions").bulkAdd([
      { ...base, id: "00000000-0000-4000-8000-0000000000t1", type: "expense", amount: 200 },
      { ...base, id: "00000000-0000-4000-8000-0000000000t2", type: "expense", amount: 100 },
    ]);
    await legacy.table("goalTransactions").add({
      id: "00000000-0000-4000-8000-0000000000g1",
      goalId: "00000000-0000-4000-8000-0000000000gg",
      amount: 200,
      date: base.date,
      memo: "",
      transactionId: "00000000-0000-4000-8000-0000000000t1",
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    });
    await legacy.table("debtPayments").add({
      id: "00000000-0000-4000-8000-0000000000p1",
      debtId: "00000000-0000-4000-8000-0000000000dd",
      amount: 100,
      date: base.date,
      memo: "",
      transactionId: "00000000-0000-4000-8000-0000000000t2",
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    });
    legacy.close();

    const db = new AppDatabase(name);
    await db.open();
    expect((await db.transactions.get("00000000-0000-4000-8000-0000000000t1"))?.goalId).toBe(
      "00000000-0000-4000-8000-0000000000gg",
    );
    expect((await db.transactions.get("00000000-0000-4000-8000-0000000000t2"))?.debtId).toBe(
      "00000000-0000-4000-8000-0000000000dd",
    );
    db.close();
    await Dexie.delete(name);
  });
});

describe("dette reliée à un compte à la création", () => {
  it("un emprunt relié à un compte crée un revenu marqué dans ce compte", async () => {
    const db = new AppDatabase(`test-${crypto.randomUUID()}`);
    const wallet = await createWallet(
      { name: "BNI", icon: "🏦", color: "#000000", group: "bank", currency: "MGA", initialBalance: 0, includeInTotal: true, archived: false },
      db,
    );
    const income = await createCategory(
      { name: "Emprunts", kind: "income", icon: "🤝", color: "#000000", archived: false },
      db,
    );
    await createDebt(
      {
        linkWalletId: wallet.id,
        categoryId: income.id,
        direction: "borrowed",
        counterparty: "Cousin",
        principal: 300_000,
        currency: "MGA",
        startDate: new Date().toISOString(),
        notes: "",
      },
      db,
    );
    const rows = await db.transactions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("income");
    expect(rows[0]?.walletId).toBe(wallet.id);
    expect(rows[0]?.debtId).toBeDefined();
    db.close();
  });
});

describe("reste du mois avec objectifs et dettes", () => {
  it("le reste tient compte des versements et des dettes, mais pas la dépense", async () => {
    const { cycleSummary } = await import("../../src/domain/cycle");
    const { accountingMonth } = await import("../../src/domain/period");
    const period = accountingMonth(new Date(2026, 2, 10, 12), 1);
    const at = new Date(2026, 2, 3, 12).toISOString();
    const transactions = [
      tx({ type: "income", amount: 1_000_000, date: at }),
      tx({ type: "expense", amount: 200_000, date: at }),
      tx({ type: "expense", amount: 100_000, date: at, goalId: "00000000-0000-4000-8000-0000000000gg" }),
      tx({ type: "expense", amount: 50_000, date: at, debtId: "00000000-0000-4000-8000-0000000000dd" }),
    ];
    const s = cycleSummary(transactions, period, new Date(2026, 2, 10, 12), 0);
    expect(s.expense).toBe(200_000);
    expect(s.savedToGoals).toBe(100_000);
    expect(s.debtsPaid).toBe(50_000);
    expect(s.saved).toBe(650_000);
  });
});

describe("dette reliée à un compte sans catégorie", () => {
  it("est refusée sans rien enregistrer : ni dette orpheline, ni transaction", async () => {
    const db = new AppDatabase(`test-${crypto.randomUUID()}`);
    const wallet = await createWallet(
      { name: "BNI", icon: "🏦", color: "#000000", group: "bank", currency: "MGA", initialBalance: 0, includeInTotal: true, archived: false },
      db,
    );
    await expect(
      createDebt(
        {
          linkWalletId: wallet.id,
          direction: "borrowed",
          counterparty: "Cousin",
          principal: 300_000,
          currency: "MGA",
          startDate: new Date().toISOString(),
          notes: "",
        },
        db,
      ),
    ).rejects.toThrow("Choisissez une catégorie, ou créez-en une.");
    expect(await db.debts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });
});
