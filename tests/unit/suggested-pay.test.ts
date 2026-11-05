import { describe, expect, it } from "vitest";
import type { Transaction, Wallet } from "../../src/db/entities";
import { cycleOverview } from "../../src/domain/cycle";
import { accountingMonth } from "../../src/domain/period";

const W = "00000000-0000-4000-8000-0000000000aa";
const SALARY = "00000000-0000-4000-8000-0000000000ss";

function tx(partial: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "date">): Transaction {
  return {
    id: `00000000-0000-4000-8000-${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
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

const wallets = [
  { id: W, name: "BNI", icon: "🏦", color: "#000", group: "bank", currency: "MGA", initialBalance: 0, includeInTotal: true, archived: false, createdAt: "", updatedAt: "" },
] as unknown as Wallet[];

describe("proposition de revenu de paie (suggestedPay)", () => {
  const now = new Date(2026, 2, 10, 12);
  const period = accountingMonth(now, 1);

  it("sans revenu de paie choisi : la dernière entrée de revenu est proposée", () => {
    const transactions = [
      tx({ type: "income", amount: 500_000, categoryId: SALARY, date: new Date(2026, 1, 27, 9).toISOString() }),
      tx({ type: "income", amount: 800_000, categoryId: SALARY, date: new Date(2026, 2, 5, 9).toISOString() }),
    ];
    const v = cycleOverview({
      wallets, transactions, recurring: [], debts: [], debtPayments: [], rates: [],
      baseCurrency: "MGA", period, now, payCategoryId: undefined,
    });
    expect(v.suggestedPay?.categoryId).toBe(SALARY);
    expect(v.suggestedPay?.amount).toBe(800_000);
  });

  it("revenu de paie déjà choisi : rien à proposer", () => {
    const transactions = [
      tx({ type: "income", amount: 500_000, categoryId: SALARY, date: new Date(2026, 2, 5, 9).toISOString() }),
    ];
    const v = cycleOverview({
      wallets, transactions, recurring: [], debts: [], debtPayments: [], rates: [],
      baseCurrency: "MGA", period, now, payCategoryId: SALARY,
    });
    expect(v.suggestedPay).toBeUndefined();
  });

  it("aucune entrée : rien à proposer", () => {
    const v = cycleOverview({
      wallets, transactions: [], recurring: [], debts: [], debtPayments: [], rates: [],
      baseCurrency: "MGA", period, now, payCategoryId: undefined,
    });
    expect(v.suggestedPay).toBeUndefined();
  });
});

describe("proposition de paie : catégories qui reviennent seulement", () => {
  const now = new Date(2026, 2, 10, 12);
  const period = accountingMonth(now, 1);

  it("une entrée isolée (remboursement, vente ponctuelle) n'est pas proposée", () => {
    const transactions = [
      tx({ type: "income", amount: 130_000, categoryId: "00000000-0000-4000-8000-0000000000rr", date: new Date(2026, 2, 4, 9).toISOString() }),
    ];
    const v = cycleOverview({
      wallets, transactions, recurring: [], debts: [], debtPayments: [], rates: [],
      baseCurrency: "MGA", period, now, payCategoryId: undefined,
    });
    expect(v.suggestedPay).toBeUndefined();
  });
});
