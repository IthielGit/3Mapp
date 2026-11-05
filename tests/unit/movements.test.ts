import Dexie from "dexie";
import { describe, expect, it } from "vitest";
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
