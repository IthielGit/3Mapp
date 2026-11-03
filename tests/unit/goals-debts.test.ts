import { describe, expect, it } from "vitest";
import { goalBalance, goalProgress } from "../../src/domain/goals";
import { accruedInterest, debtState } from "../../src/domain/debts";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

describe("objectifs d’épargne (SPEC §5.9)", () => {
  it("le montant épargné est la somme des versements et retraits", () => {
    expect(
      goalBalance([
        { amount: 100000, date: day(2026, 1, 1) },
        { amount: 50000, date: day(2026, 1, 10) },
        { amount: -20000, date: day(2026, 1, 20) },
      ]),
    ).toBe(130000);
  });

  it("progression et objectif atteint", () => {
    const p = goalProgress(
      200000,
      [{ amount: 200000, date: day(2026, 1, 1) }],
      new Date(2026, 1, 1),
    );
    expect(p.percent).toBe(100);
    expect(p.reached).toBe(true);
    expect(p.remaining).toBe(0);
    expect(p.estimatedDate).toBeNull();
  });

  it("date estimée au rythme observé", () => {
    // 100 000 épargnés en 10 jours : 10 000 par jour. Reste 300 000 → 30 jours.
    const now = new Date(2026, 0, 11, 12);
    const p = goalProgress(400000, [{ amount: 100000, date: day(2026, 1, 1) }], now);
    expect(p.saved).toBe(100000);
    expect(p.remaining).toBe(300000);
    expect(
      Math.round(((p.estimatedDate ?? new Date(0)).getTime() - now.getTime()) / (24 * 3600 * 1000)),
    ).toBe(30);
  });

  it("sans versement : pas de date estimée", () => {
    expect(goalProgress(100000, [], new Date()).estimatedDate).toBeNull();
  });
});

describe("dettes et prêts (SPEC §5.10)", () => {
  const loan = { principal: 1000000, startDate: day(2026, 1, 1), dueDate: day(2026, 6, 30) };

  it("reste dû exact après plusieurs paiements partiels", () => {
    const payments = [{ amount: 300000 }, { amount: 150000 }, { amount: 50000 }];
    const s = debtState(loan, payments, new Date(2026, 2, 1));
    expect(s.paid).toBe(500000);
    expect(s.remaining).toBe(500000);
    expect(s.status).toBe("ongoing");
  });

  it("soldée quand les paiements couvrent le total", () => {
    const s = debtState(loan, [{ amount: 600000 }, { amount: 400000 }], new Date(2026, 2, 1));
    expect(s.remaining).toBe(0);
    expect(s.status).toBe("settled");
  });

  it("en retard après l’échéance si non soldée", () => {
    expect(debtState(loan, [{ amount: 100000 }], new Date(2026, 6, 15)).status).toBe("late");
  });

  it("intérêts simples : principal × taux × jours / 365", () => {
    // 1 000 000 à 12 % pendant 365 jours : 120 000 d'intérêts.
    expect(accruedInterest(1000000, 12, day(2026, 1, 1), new Date(2027, 0, 1, 12))).toBe(120000);
    const s = debtState({ ...loan, interestRate: 12 }, [], new Date(2027, 0, 1, 12));
    expect(s.totalDue).toBe(1120000);
    expect(s.remaining).toBe(1120000);
  });

  it("sans taux : aucun intérêt", () => {
    expect(accruedInterest(1000000, undefined, day(2026, 1, 1), new Date(2027, 0, 1))).toBe(0);
  });
});
