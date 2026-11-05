import { describe, expect, it } from "vitest";
import type { Transaction } from "../../src/db/entities";
import { walletBalance } from "../../src/domain/balance";
import {
  accountingMonth,
  periodFor,
  previousPeriod,
  weekOf,
  type Period,
} from "../../src/domain/period";
import {
  balanceEvolution,
  bucketTotals,
  expenseByCategory,
  periodSummary,
  topExpenses,
  transactionsIn,
} from "../../src/domain/stats";

const W = "00000000-0000-4000-8000-0000000000aa";
const W2 = "00000000-0000-4000-8000-0000000000bb";
const C = "00000000-0000-4000-8000-0000000000cc";

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

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("mois comptable (SPEC §5.5)", () => {
  it("début de mois le 1 : du 1er au dernier jour", () => {
    const p = accountingMonth(new Date(2026, 0, 15), 1);
    expect(p.from).toEqual(new Date(2026, 0, 1));
    expect(p.to).toEqual(new Date(2026, 1, 1));
  });

  it("mois du 28 au 27 : le 27 janvier appartient à « 28 déc. – 27 janv. »", () => {
    const jan27 = accountingMonth(new Date(2026, 0, 27, 18), 28);
    expect(jan27.from).toEqual(new Date(2025, 11, 28));
    expect(jan27.to).toEqual(new Date(2026, 0, 28));

    const jan28 = accountingMonth(new Date(2026, 0, 28, 0, 0), 28);
    expect(jan28.from).toEqual(new Date(2026, 0, 28));
    expect(jan28.to).toEqual(new Date(2026, 1, 28));
  });

  it("jour de début 31 ramené au dernier jour du mois court", () => {
    const feb = accountingMonth(new Date(2026, 1, 10), 28);
    expect(feb.from).toEqual(new Date(2026, 0, 28));
  });

  it("la période précédente est juste avant", () => {
    const current = periodFor("month", new Date(2026, 0, 15), {
      monthStartDay: 1,
      weekStartDay: 1,
    });
    const before = previousPeriod(current, "month", { monthStartDay: 1, weekStartDay: 1 });
    expect(before.from).toEqual(new Date(2025, 11, 1));
    expect(before.to).toEqual(new Date(2026, 0, 1));
  });
});

describe("semaine", () => {
  it("semaine commençant le lundi", () => {
    // Mercredi 14 janvier 2026
    const p = weekOf(new Date(2026, 0, 14), 1);
    expect(p.from).toEqual(new Date(2026, 0, 12));
    expect(p.to).toEqual(new Date(2026, 0, 19));
  });
});

describe("résumé de période (SPEC §6)", () => {
  const period: Period = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) };
  const list = [
    tx({ type: "income", amount: 1000, date: at(2026, 1, 5) }),
    tx({ type: "expense", amount: 250, categoryId: C, date: at(2026, 1, 6) }),
    tx({ type: "transfer", amount: 5000, toWalletId: W2, date: at(2026, 1, 7) }),
    tx({ type: "adjustment", amount: -700, date: at(2026, 1, 8) }),
  ];

  it("les virements ne comptent pas ; un ajustement négatif compte en dépense", () => {
    const s = periodSummary(transactionsIn(list, period, "MGA"), period, new Date(2026, 0, 31));
    expect(s.income).toBe(1000);
    expect(s.expense).toBe(950);
    expect(s.net).toBe(50);
  });

  it("un ajustement positif compte en revenu", () => {
    const withGain = [...list, tx({ type: "adjustment", amount: 400, date: at(2026, 1, 9) })];
    const s = periodSummary(transactionsIn(withGain, period, "MGA"), period, new Date(2026, 0, 31));
    expect(s.income).toBe(1400);
    expect(s.expense).toBe(950);
    expect(s.net).toBe(450);
  });

  it("taux d’épargne = net / revenus", () => {
    const s = periodSummary(transactionsIn(list, period, "MGA"), period, new Date(2026, 0, 31));
    expect(s.savingsRate).toBe(5);
  });

  it("pas de taux d’épargne sans revenus", () => {
    const s = periodSummary([tx({ type: "expense", amount: 100, date: at(2026, 1, 2) })], period);
    expect(s.savingsRate).toBeNull();
  });

  it("répartition par catégorie triée, parts sur 100 %", () => {
    const slices = expenseByCategory(
      [
        tx({ type: "expense", amount: 300, categoryId: C, date: at(2026, 1, 2) }),
        tx({ type: "expense", amount: 100, date: at(2026, 1, 3) }),
      ],
      new Map([[C, "Alimentation"]]),
    );
    expect(slices.map((s) => s.name)).toEqual(["Alimentation", "Sans catégorie"]);
    expect(slices[0]?.share).toBe(75);
    expect(slices[1]?.share).toBe(25);
  });

  it("top 10 des dépenses", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      tx({ type: "expense", amount: (i + 1) * 100, date: at(2026, 1, 2) }),
    );
    const top = topExpenses(many, 10);
    expect(top).toHaveLength(10);
    expect(top[0]?.amount).toBe(1200);
    expect(top[9]?.amount).toBe(300);
  });

  it("totaux par mois", () => {
    const buckets = bucketTotals(
      [
        tx({ type: "income", amount: 500, date: at(2026, 1, 2) }),
        tx({ type: "expense", amount: 200, date: at(2026, 2, 2) }),
      ],
      (t) => t.date.slice(0, 7),
      ["2026-01", "2026-02"],
    );
    expect(buckets).toEqual([
      { key: "2026-01", income: 500, expense: 0 },
      { key: "2026-02", income: 0, expense: 200 },
    ]);
  });
});

describe("évolution du solde", () => {
  it("le dernier point égale la somme des soldes réels (mouvements antérieurs inclus)", () => {
    const wallet = { id: W, initialBalance: 1000, currency: "MGA" as const };
    const other = { id: W2, initialBalance: 200, currency: "MGA" as const };
    const txs = [
      tx({ type: "income", amount: 500, date: at(2025, 12, 20) }), // avant la période
      tx({ type: "expense", amount: 300, date: at(2026, 1, 3) }),
      tx({
        type: "transfer",
        amount: 400,
        walletId: W,
        toWalletId: W2,
        fee: 20,
        date: at(2026, 1, 4),
      }),
    ];
    const days = ["2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];
    const series = balanceEvolution([wallet, other], txs, days, "MGA");
    const expected = walletBalance(wallet, txs) + walletBalance(other, txs);
    expect(series.at(-1)?.balance).toBe(expected);
    expect(series[0]?.balance).toBe(1000 + 200 + 500);
  });
});

describe("transactions de la période", () => {
  it("filtre par devise et par bornes", () => {
    const period: Period = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) };
    const list = [
      tx({ type: "expense", amount: 1, date: at(2026, 1, 1, 0) }),
      tx({ type: "expense", amount: 2, date: at(2026, 0, 31, 23), currency: "EUR" }),
      tx({ type: "expense", amount: 3, date: at(2026, 2, 1) }),
    ];
    expect(transactionsIn(list, period, "MGA").map((t) => t.amount)).toEqual([1]);
  });
});
