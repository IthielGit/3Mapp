import { describe, expect, it } from "vitest";
import type { ExchangeRate } from "../../src/db/entities";
import { convertRaw, convertedSum, rateAt } from "../../src/domain/fx";

const rate = (
  from: "EUR" | "MGA" | "USD",
  to: "EUR" | "MGA" | "USD",
  value: number,
  date: string,
): ExchangeRate => ({
  id: `${from}-${to}-${date}`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  from,
  to,
  rate: value,
  date,
});

const rates = [
  rate("EUR", "MGA", 5000, "2026-01-01T00:00:00.000Z"),
  rate("EUR", "MGA", 5200, "2026-03-01T00:00:00.000Z"),
];

describe("taux de change datés", () => {
  it("prend le dernier taux connu à la date demandée", () => {
    expect(rateAt(rates, "EUR", "MGA", new Date("2026-02-15T00:00:00.000Z"))).toBe(5000);
    expect(rateAt(rates, "EUR", "MGA", new Date("2026-04-01T00:00:00.000Z"))).toBe(5200);
  });

  it("même devise : taux 1", () => {
    expect(rateAt([], "MGA", "MGA", new Date())).toBe(1);
  });

  it("taux inverse déduit", () => {
    expect(rateAt(rates, "MGA", "EUR", new Date("2026-04-01T00:00:00.000Z"))).toBeCloseTo(
      1 / 5200,
      10,
    );
  });

  it("aucun taux : null", () => {
    expect(rateAt([], "USD", "MGA", new Date())).toBeNull();
  });
});

describe("conversion", () => {
  it("tient compte des décimales : 12,50 EUR (1250) → Ar à 5 000", () => {
    // 12,50 € × 5 000 = 62 500 Ar
    expect(convertRaw(1250, "EUR", "MGA", 5000)).toBe(62500);
  });

  it("total converti : arrondi une seule fois, devises manquantes signalées", () => {
    const items = [
      { amount: 1250, currency: "EUR" as const, date: "2026-02-10T00:00:00.000Z" }, // 62 500 Ar
      { amount: 100, currency: "EUR" as const, date: "2026-03-10T00:00:00.000Z" }, // 5 200 Ar
      { amount: 999, currency: "USD" as const, date: "2026-03-10T00:00:00.000Z" }, // pas de taux
    ];
    const result = convertedSum(items, "MGA", rates);
    expect(result.total).toBe(62500 + 5200);
    expect(result.missing).toEqual(["USD"]);
  });
});
