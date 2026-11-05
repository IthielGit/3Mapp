import { describe, expect, it } from "vitest";
import type { Transaction } from "../../src/db/entities";
import { evaluateExpression, expressionToMinor } from "../../src/lib/calc";
import { computeBalances, walletBalance } from "../../src/domain/balance";
import { filterTransactions } from "../../src/domain/filters";
import { groupByDay } from "../../src/domain/grouping";
import { totals } from "../../src/domain/totals";

const W1 = "00000000-0000-4000-8000-000000000001";
const W2 = "00000000-0000-4000-8000-000000000002";
const C1 = "00000000-0000-4000-8000-000000000011";

let counter = 0;
function tx(
  partial: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "walletId">,
): Transaction {
  counter++;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    currency: "MGA",
    memo: "",
    attachmentIds: [],
    date: new Date(2026, 0, 15, 10).toISOString(),
    status: "posted",
    ...partial,
  };
}

describe("calculatrice (lib/calc)", () => {
  it("priorité des opérateurs", () => {
    expect(evaluateExpression("2+3×4")).toBe(14);
    expect(evaluateExpression("10−4÷2")).toBe(8);
    expect(evaluateExpression("8/2/2")).toBe(2);
  });

  it("décimales avec virgule ou point", () => {
    expect(evaluateExpression("12,5+0.5")).toBe(13);
  });

  it("signe moins initial", () => {
    expect(evaluateExpression("-5+3")).toBe(-2);
  });

  it("expressions incomplètes ou invalides refusées", () => {
    expect(evaluateExpression("")).toBeNull();
    expect(evaluateExpression("5+")).toBeNull();
    expect(evaluateExpression("5*-2")).toBeNull();
    expect(evaluateExpression("5//2")).toBeNull();
    expect(evaluateExpression("abc")).toBeNull();
    expect(evaluateExpression("5/0")).toBeNull();
  });

  it("conversion en unités mineures avec un seul arrondi", () => {
    expect(expressionToMinor("12.5+3", "EUR")).toBe(1550);
    expect(expressionToMinor("2×3,5", "EUR")).toBe(700);
    expect(expressionToMinor("10/3", "MGA")).toBe(3);
    expect(expressionToMinor("7÷2", "MGA")).toBe(4);
    expect(expressionToMinor("0.1+0.2", "EUR")).toBe(30);
    expect(expressionToMinor("1+", "EUR")).toBeNull();
  });
});

describe("soldes (domain/balance, SPEC §6.1)", () => {
  const wallet1 = { id: W1, initialBalance: 1000 };
  const wallet2 = { id: W2, initialBalance: 0 };

  it("part du solde initial et applique revenus, dépenses et ajustements", () => {
    const list = [
      tx({ type: "income", amount: 500, walletId: W1 }),
      tx({ type: "expense", amount: 200, walletId: W1, categoryId: C1 }),
      tx({ type: "adjustment", amount: -50, walletId: W1 }),
    ];
    expect(walletBalance(wallet1, list)).toBe(1000 + 500 - 200 - 50);
  });

  it("ignore les transactions en attente", () => {
    const list = [tx({ type: "expense", amount: 300, walletId: W1, status: "pending" })];
    expect(walletBalance(wallet1, list)).toBe(1000);
  });

  it("un virement retire du source (plus frais) et ajoute à la destination", () => {
    const list = [tx({ type: "transfer", amount: 400, fee: 25, walletId: W1, toWalletId: W2 })];
    const balances = computeBalances([wallet1, wallet2], list);
    expect(balances[W1]).toBe(1000 - 400 - 25);
    expect(balances[W2]).toBe(400);
  });

  it("virement entre devises : la destination reçoit toAmount", () => {
    const list = [
      tx({ type: "transfer", amount: 100000, toAmount: 2300, walletId: W1, toWalletId: W2 }),
    ];
    expect(walletBalance({ id: W2, initialBalance: 0 }, list)).toBe(2300);
  });

  it("la somme des soldes ne change pas avec un virement (sans frais)", () => {
    const before = computeBalances([wallet1, wallet2], []);
    const after = computeBalances(
      [wallet1, wallet2],
      [tx({ type: "transfer", amount: 350, walletId: W1, toWalletId: W2 })],
    );
    const sum = (b: Record<string, number>) => Object.values(b).reduce((a, n) => a + n, 0);
    expect(sum(after)).toBe(sum(before));
  });
});

describe("totaux (domain/totals, SPEC §6.2 et §6.3)", () => {
  it("exclut les virements ; les ajustements entrent dans le net seulement", () => {
    const list = [
      tx({ type: "income", amount: 1000, walletId: W1 }),
      tx({ type: "expense", amount: 300, walletId: W1 }),
      tx({ type: "transfer", amount: 5000, walletId: W1, toWalletId: W2 }),
      tx({ type: "adjustment", amount: -700, walletId: W1 }),
    ];
    expect(totals(list)).toEqual({ income: 1000, expense: 300, net: 0 });
  });
});

describe("filtres (domain/filters)", () => {
  const list = [
    tx({ type: "expense", amount: 1000, walletId: W1, categoryId: C1, memo: "Riz et huile" }),
    tx({ type: "income", amount: 50000, walletId: W2, memo: "Salaire" }),
    tx({ type: "transfer", amount: 2000, walletId: W1, toWalletId: W2, memo: "Épargne" }),
  ];
  const names = new Map([[C1, "Alimentation"]]);

  it("filtre par type et par portefeuille (le virement compte pour ses deux portefeuilles)", () => {
    expect(filterTransactions(list, { types: ["transfer"] })).toHaveLength(1);
    expect(filterTransactions(list, { walletId: W2 })).toHaveLength(2);
  });

  it("montants min et max en valeur absolue", () => {
    expect(filterTransactions(list, { minAmount: 1500, maxAmount: 60000 })).toHaveLength(2);
  });

  it("recherche dans le mémo et le nom de catégorie, sans casse", () => {
    expect(filterTransactions(list, { query: "RIZ" }, names)).toHaveLength(1);
    expect(filterTransactions(list, { query: "alimentation" }, names)).toHaveLength(1);
    expect(filterTransactions(list, { query: "introuvable" }, names)).toHaveLength(0);
  });

  it("bornes de date", () => {
    const from = new Date(2026, 0, 16).toISOString();
    expect(filterTransactions(list, { from })).toHaveLength(0);
  });
});

describe("regroupement par jour (domain/grouping)", () => {
  it("regroupe par jour local et calcule le net journalier", () => {
    const list = [
      tx({
        type: "income",
        amount: 500,
        walletId: W1,
        date: new Date(2026, 0, 16, 9).toISOString(),
      }),
      tx({
        type: "expense",
        amount: 200,
        walletId: W1,
        date: new Date(2026, 0, 16, 8).toISOString(),
      }),
      tx({
        type: "expense",
        amount: 90,
        walletId: W1,
        date: new Date(2026, 0, 15, 20).toISOString(),
      }),
    ];
    const groups = groupByDay(list);
    expect(groups.map((g) => g.day)).toEqual(["2026-01-16", "2026-01-15"]);
    expect(groups[0]?.net).toBe(300);
    expect(groups[0]?.items).toHaveLength(2);
  });
});
