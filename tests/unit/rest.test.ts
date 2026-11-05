import { describe, expect, it } from "vitest";
import type { Debt, Recurring, Transaction, Wallet } from "../../src/db/entities";
import { cycleOverview, payStatus, restAVivre } from "../../src/domain/cycle";
import { accountingMonth } from "../../src/domain/period";
import { upcomingOccurrences } from "../../src/domain/recurrence";

const W = "00000000-0000-4000-8000-0000000000aa";
const S = "00000000-0000-4000-8000-0000000000ss";
const PAY = "00000000-0000-4000-8000-0000000000pp";
const RENT = "00000000-0000-4000-8000-0000000000rr";

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

describe("reste à vivre (restAVivre)", () => {
  it("disponible moins les engagements, puis divisé par les jours restants", () => {
    const r = restAVivre({ available: 500_000, pendingExpenses: 0, upcomingExpenses: 0, debtsDue: 0, daysLeft: 10 });
    expect(r).toEqual({ rest: 500_000, perDay: 50_000, overdrawn: false });
  });

  it("une dépense en attente réduit le reste (elle n'est pas encore dans le solde)", () => {
    const r = restAVivre({ available: 500_000, pendingExpenses: 50_000, upcomingExpenses: 0, debtsDue: 0, daysLeft: 10 });
    expect(r.rest).toBe(450_000);
  });

  it("récurrences et dettes à venir sont déduites", () => {
    const r = restAVivre({ available: 500_000, pendingExpenses: 0, upcomingExpenses: 300_000, debtsDue: 150_000, daysLeft: 10 });
    expect(r).toEqual({ rest: 50_000, perDay: 5_000, overdrawn: false });
  });

  it("reste nul : 0 par jour, pas de dépassement", () => {
    const r = restAVivre({ available: 500_000, pendingExpenses: 0, upcomingExpenses: 300_000, debtsDue: 200_000, daysLeft: 10 });
    expect(r).toEqual({ rest: 0, perDay: 0, overdrawn: false });
  });

  it("engagements supérieurs au disponible : dépassement, 0 par jour", () => {
    const r = restAVivre({ available: 100_000, pendingExpenses: 0, upcomingExpenses: 150_000, debtsDue: 0, daysLeft: 10 });
    expect(r).toEqual({ rest: -50_000, perDay: 0, overdrawn: true });
  });

  it("jour de paie aujourd'hui (0 jour restant) : pas de division par zéro", () => {
    const r = restAVivre({ available: 100_000, pendingExpenses: 0, upcomingExpenses: 0, debtsDue: 0, daysLeft: 0 });
    expect(r.perDay).toBe(100_000);
  });
});

describe("occurrences à venir (upcomingOccurrences)", () => {
  const base = {
    startDate: new Date(2026, 1, 5).toISOString(),
    frequency: { unit: "week" as const, interval: 1 },
    dayOfMonthRule: "same_day" as const,
    occurrenceIndex: 0,
  };

  it("une récurrence hebdomadaire compte chaque occurrence avant la date limite", () => {
    const dates = upcomingOccurrences(base, new Date(2026, 2, 1));
    // 5, 12, 19, 26 février (1er mars exclu)
    expect(dates.length).toBe(4);
  });

  it("ne compte que les occurrences non encore générées (à partir de occurrenceIndex)", () => {
    const dates = upcomingOccurrences({ ...base, occurrenceIndex: 2 }, new Date(2026, 2, 1));
    expect(dates.length).toBe(2);
  });

  it("respecte la date de fin", () => {
    const dates = upcomingOccurrences(
      { ...base, endDate: new Date(2026, 1, 12).toISOString() },
      new Date(2026, 2, 1),
    );
    expect(dates.length).toBe(2);
  });
});

describe("statut de la paie (payStatus)", () => {
  // Cycle du 27 février au 27 mars 2026 (le 28 est un samedi, le vendredi est pris).
  const period = accountingMonth(new Date(2026, 2, 10), 28, true);
  const day = (d: number, h = 12) => new Date(2026, 1, d, h).getTime();
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12);

  it("sans catégorie de paie choisie : non défini", () => {
    expect(payStatus([], undefined, period, at(2026, 2, 10))).toEqual({ kind: "unset" });
  });

  it("paie reçue le jour de paie : reçue", () => {
    const pays = [tx({ type: "income", amount: 1_200_000, categoryId: PAY, date: new Date(day(27)).toISOString() })];
    const s = payStatus(pays, PAY, period, at(2026, 2, 10));
    expect(s.kind).toBe("received");
    if (s.kind === "received") expect(s.amount).toBe(1_200_000);
  });

  it("paie reçue jusqu'à 5 jours avant le début du cycle : elle compte pour ce cycle", () => {
    const pays = [tx({ type: "income", amount: 1_200_000, categoryId: PAY, date: new Date(day(23)).toISOString() })];
    expect(payStatus(pays, PAY, period, at(2026, 2, 10)).kind).toBe("received");
  });

  it("paie plus de 5 jours avant : elle n'est pas comptée pour ce cycle", () => {
    const pays = [tx({ type: "income", amount: 1_200_000, categoryId: PAY, date: new Date(day(20)).toISOString() })];
    expect(payStatus(pays, PAY, period, at(2026, 1, 28)).kind).toBe("expected");
  });

  it("paie en attente (non validée) : ignorée", () => {
    const pays = [tx({ type: "income", amount: 1_200_000, categoryId: PAY, status: "pending", date: new Date(day(27)).toISOString() })];
    expect(payStatus(pays, PAY, period, at(2026, 1, 28)).kind).toBe("expected");
  });

  it("pas encore reçue, jour de paie depuis peu : attendue", () => {
    expect(payStatus([], PAY, period, at(2026, 1, 28)).kind).toBe("expected");
  });

  it("pas reçue plus de 3 jours après le jour de paie : en retard", () => {
    const s = payStatus([], PAY, period, at(2026, 2, 3));
    expect(s.kind).toBe("late");
    if (s.kind === "late") expect(s.daysLate).toBe(4);
  });
});

describe("vue « Mon cycle » complète (cycleOverview)", () => {
  it("assemble disponible, engagements et reste à vivre sur un cas réaliste", () => {
    const wallets = [
      { id: W, name: "BNI", icon: "🏦", color: "#000", group: "bank", currency: "MGA", initialBalance: 1_000_000, includeInTotal: true, archived: false, createdAt: "", updatedAt: "" },
      { id: S, name: "Épargne", icon: "🐷", color: "#000", group: "savings", currency: "MGA", initialBalance: 500_000, includeInTotal: true, archived: false, createdAt: "", updatedAt: "" },
    ] as unknown as Wallet[];
    const recurring = [
      {
        id: RENT, type: "expense", amount: 300_000, currency: "MGA", walletId: W, memo: "Loyer",
        frequency: { unit: "month", interval: 1 }, startDate: new Date(2026, 2, 20).toISOString(),
        nextDate: new Date(2026, 2, 20).toISOString(), occurrenceIndex: 0, autoPost: false, paused: false,
        dayOfMonthRule: "same_day", createdAt: "", updatedAt: "",
      },
    ] as unknown as Recurring[];
    const debts = [
      { id: "00000000-0000-4000-8000-0000000000dd", direction: "borrowed", counterparty: "Cousin", principal: 400_000, currency: "MGA", startDate: new Date(2026, 1, 1).toISOString(), dueDate: new Date(2026, 2, 15).toISOString(), notes: "", createdAt: "", updatedAt: "" },
    ] as unknown as Debt[];
    const transactions = [
      tx({ type: "income", amount: 1_200_000, categoryId: PAY, date: new Date(2026, 1, 27, 12).toISOString() }),
      tx({ type: "expense", amount: 200_000, date: new Date(2026, 2, 2, 12).toISOString() }),
      tx({ type: "expense", amount: 50_000, status: "pending", date: new Date(2026, 2, 9, 12).toISOString() }),
    ];
    const now = new Date(2026, 2, 10, 12);
    const period = accountingMonth(now, 28, true);

    const v = cycleOverview({
      wallets, transactions, recurring, debts, debtPayments: [], rates: [],
      baseCurrency: "MGA", period, now, payCategoryId: PAY,
    });

    expect(period.from).toEqual(new Date(2026, 1, 27));
    expect(v.summary.available).toBe(2_000_000); // 1 000 000 + 1 200 000 − 200 000 ; épargne exclue
    expect(v.pendingExpenses).toBe(50_000);
    expect(v.upcomingExpenses).toBe(300_000);
    expect(v.debtsDue).toBe(400_000);
    expect(v.rest.rest).toBe(1_250_000);
    expect(v.rest.perDay).toBe(Math.floor(1_250_000 / v.summary.daysLeft));
    expect(v.pay.kind).toBe("received");
    // Paie 1 200 000 − dépenses 200 000 − en attente 50 000 − récurrence 300 000 − dette 400 000.
    expect(v.plannedSaving).toBe(250_000);
  });
});
