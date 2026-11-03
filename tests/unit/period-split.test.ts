import { describe, expect, it } from "vitest";
import { splitPeriods } from "../../src/domain/period";

describe("découpage de période", () => {
  it("une année en 12 mois comptables (début le 28)", () => {
    const year = { from: new Date(2026, 0, 1), to: new Date(2027, 0, 1) };
    const months = splitPeriods(year, "month", { monthStartDay: 28, weekStartDay: 1 });
    expect(months).toHaveLength(13); // 28 déc. 2025 – 27 janv. jusqu’au 28 déc. 2026
    expect(months[0]?.from).toEqual(new Date(2025, 11, 28));
  });

  it("un mois en semaines lundi-dimanche", () => {
    const jan = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) };
    const weeks = splitPeriods(jan, "week", { monthStartDay: 1, weekStartDay: 1 });
    expect(weeks[0]?.from).toEqual(new Date(2025, 11, 29)); // lundi qui contient le 1er
    expect(weeks.at(-1)?.to.getTime()).toBeGreaterThanOrEqual(jan.to.getTime());
  });
});
