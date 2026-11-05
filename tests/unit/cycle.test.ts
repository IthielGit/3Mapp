import { describe, expect, it } from "vitest";
import type { Transaction } from "../../src/db/entities";
import { cycleSummary } from "../../src/domain/cycle";
import { spentIn } from "../../src/domain/budget";
import { accountingMonth } from "../../src/domain/period";

const W = "00000000-0000-4000-8000-0000000000aa";

let n = 0;
function tx(
  partial: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "date">,
): Transaction {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    currency: "MGA",
    walletId: W,
    memo: "",
    attachmentIds: [],
    status: "posted",
    ...partial,
  };
}

// Cycle du 28 au 27 : ancre le 10 mars → cycle du 28 févr. au 27 mars.
const period = accountingMonth(new Date(2026, 2, 10), 28);

describe("budget : dépenses après la date de début seulement", () => {
  it("une dépense antérieure à startDate n'est pas comptée dans la première période", () => {
    const budget = {
      categoryIds: ["00000000-0000-4000-8000-0000000000cc"],
      walletIds: [],
      currency: "MGA" as const,
      startDate: new Date(2026, 0, 15).toISOString(),
    };
    const cat = "00000000-0000-4000-8000-0000000000cc";
    const transactions = [
      tx({ type: "expense", amount: 50_000, categoryId: cat, date: new Date(2026, 0, 10).toISOString() }),
      tx({ type: "expense", amount: 20_000, categoryId: cat, date: new Date(2026, 0, 20).toISOString() }),
    ];
    const period = accountingMonth(new Date(2026, 0, 20), 1);
    expect(spentIn(budget, transactions, period)).toBe(20_000);
  });
});

describe("cycleSummary (Mon cycle)", () => {
  it("compte entrées, sorties et mis de côté dans le cycle, en ignorant les autres cycles", () => {
    const transactions = [
      tx({ type: "income", amount: 1_200_000, date: new Date(2026, 1, 28, 9).toISOString() }),
      tx({ type: "expense", amount: 640_000, date: new Date(2026, 2, 2, 9).toISOString() }),
      // Dépense du cycle précédent : hors du cycle.
      tx({ type: "expense", amount: 99_000, date: new Date(2026, 1, 27, 9).toISOString() }),
    ];
    const s = cycleSummary(transactions, period, new Date(2026, 2, 10), 560_000);
    expect(s.income).toBe(1_200_000);
    expect(s.expense).toBe(640_000);
    expect(s.saved).toBe(560_000);
    expect(s.available).toBe(560_000);
  });

  it("ignore les transactions en attente et les virements", () => {
    const transactions = [
      tx({ type: "income", amount: 500_000, date: new Date(2026, 2, 1).toISOString(), status: "pending" }),
      tx({ type: "transfer", amount: 300_000, date: new Date(2026, 2, 1).toISOString() }),
    ];
    const s = cycleSummary(transactions, period, new Date(2026, 2, 10), 0);
    expect(s.income).toBe(0);
    expect(s.expense).toBe(0);
    expect(s.saved).toBe(0);
  });

  it("le jour de paie est dans le cycle qu'il finance (borne incluse, fin exclue)", () => {
    const transactions = [
      tx({ type: "income", amount: 100, date: new Date(2026, 1, 28, 0, 0).toISOString() }),
      tx({ type: "income", amount: 1, date: new Date(2026, 2, 28, 0, 0).toISOString() }),
    ];
    const s = cycleSummary(transactions, period, new Date(2026, 2, 10), 0);
    expect(s.income).toBe(100);
  });

  it("jour 31 : ramené au dernier jour des mois courts, sans cycle vide", () => {
    // Ancre le 15 février : cycle du 31 janvier au 27 février (fin exclue au 28).
    const feb = accountingMonth(new Date(2026, 1, 15), 31);
    expect(feb.from).toEqual(new Date(2026, 0, 31));
    expect(feb.to).toEqual(new Date(2026, 1, 28));
    // Ancre le 1er mars : cycle du 28 février au 30 mars.
    const mar = accountingMonth(new Date(2026, 2, 1), 31);
    expect(mar.from).toEqual(new Date(2026, 1, 28));
    expect(mar.to).toEqual(new Date(2026, 2, 31));
  });

  it("jours restants : au moins 1, et jusqu'au début du cycle suivant", () => {
    const s = cycleSummary([], period, new Date(2026, 2, 10, 12), 0);
    // De 10 mars 12 h au 27 mars 00 h... fin exclusive au 28 mars 00 h : 18 jours environ.
    expect(s.daysLeft).toBe(Math.ceil((period.to.getTime() - new Date(2026, 2, 10, 12).getTime()) / 86_400_000));
    const last = cycleSummary([], period, new Date(period.to.getTime() + 1), 0);
    expect(last.daysLeft).toBe(1);
  });
});
