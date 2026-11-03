import { describe, expect, it } from "vitest";
import type { Budget, Transaction } from "../../src/db/entities";
import { budgetState, spentIn } from "../../src/domain/budget";

const W = "00000000-0000-4000-8000-0000000000aa";
const W2 = "00000000-0000-4000-8000-0000000000bb";
const C = "00000000-0000-4000-8000-0000000000cc";
const C2 = "00000000-0000-4000-8000-0000000000dd";
const SETTINGS = { monthStartDay: 1, weekStartDay: 1 };

let n = 0;
function expense(amount: number, date: Date, extra: Partial<Transaction> = {}): Transaction {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: "expense",
    amount,
    currency: "MGA",
    walletId: W,
    categoryId: C,
    memo: "",
    attachmentIds: [],
    date: date.toISOString(),
    status: "posted",
    ...extra,
  };
}

function budget(partial: Partial<Budget> = {}): Budget {
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    name: "Alimentation",
    amount: 100000,
    currency: "MGA",
    period: "month",
    startDate: new Date(2026, 0, 1).toISOString(),
    categoryIds: [C],
    walletIds: [],
    rollover: false,
    alertThreshold: 80,
    ...partial,
  };
}

const jan = (d: number) => new Date(2026, 0, d, 12);
const feb = (d: number) => new Date(2026, 1, d, 12);
const mar = (d: number) => new Date(2026, 2, d, 12);

describe("dépenses comptées (SPEC §6, règle 4)", () => {
  it("ignore virements, revenus, catégories non choisies, en attente et autres devises", () => {
    const period = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) };
    const txs: Transaction[] = [
      expense(1000, jan(2)),
      expense(500, jan(3), { status: "pending" }),
      expense(700, jan(4), { categoryId: C2 }),
      expense(900, jan(5), { currency: "EUR" }),
      expense(300, jan(6), { type: "income" }),
      { ...expense(200, jan(7)), type: "transfer", toWalletId: W2 },
    ];
    expect(spentIn(budget(), txs, period)).toBe(1000);
  });

  it("filtre par portefeuille si le budget en précise", () => {
    const period = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) };
    const txs = [expense(1000, jan(2), { walletId: W }), expense(400, jan(3), { walletId: W2 })];
    expect(spentIn(budget({ walletIds: [W2] }), txs, period)).toBe(400);
  });
});

describe("alerte et dépassement", () => {
  it("reste et pourcentage", () => {
    const state = budgetState(budget(), [expense(60000, jan(3))], jan(15), SETTINGS);
    expect(state.spent).toBe(60000);
    expect(state.remaining).toBe(40000);
    expect(state.percent).toBe(60);
    expect(state.status).toBe("ok");
  });

  it("seuil d’alerte atteint (80 %)", () => {
    const state = budgetState(budget(), [expense(85000, jan(3))], jan(15), SETTINGS);
    expect(state.status).toBe("threshold");
  });

  it("dépassement détecté", () => {
    const state = budgetState(budget(), [expense(120000, jan(3))], jan(15), SETTINGS);
    expect(state.status).toBe("exceeded");
    expect(state.remaining).toBe(-20000);
  });

  it("rythme journalier conseillé pour le reste du mois", () => {
    // Le 29 janvier à midi : 3 jours restants (29, 30, 31) ; reste 40 000 → 13 333 par jour.
    const state = budgetState(
      budget(),
      [expense(60000, jan(3))],
      new Date(2026, 0, 29, 12),
      SETTINGS,
    );
    expect(state.dailyAllowance).toBe(13333);
  });
});

describe("report sur périodes consécutives", () => {
  const txs = [
    expense(80000, jan(10)), // janvier : reste 20 000
    expense(90000, feb(10)), // février : disponible 120 000, reste 30 000
  ];

  it("le reste de chaque mois est reporté sur le suivant (3 périodes)", () => {
    const march = budgetState(budget({ rollover: true }), txs, mar(15), SETTINGS);
    expect(march.carry).toBe(30000);
    expect(march.available).toBe(130000);
    expect(march.spent).toBe(0);
    expect(march.remaining).toBe(130000);
  });

  it("février : disponible = base + report de janvier", () => {
    const february = budgetState(budget({ rollover: true }), txs, feb(15), SETTINGS);
    expect(february.carry).toBe(20000);
    expect(february.available).toBe(120000);
    expect(february.remaining).toBe(30000);
  });

  it("sans report, chaque mois repart de la base", () => {
    const march = budgetState(budget({ rollover: false }), txs, mar(15), SETTINGS);
    expect(march.carry).toBe(0);
    expect(march.available).toBe(100000);
  });

  it("un dépassement se reporte négativement", () => {
    const over = [expense(130000, jan(10))]; // janvier : −30 000
    const february = budgetState(budget({ rollover: true }), over, feb(15), SETTINGS);
    expect(february.carry).toBe(-30000);
    expect(february.available).toBe(70000);
  });
});
