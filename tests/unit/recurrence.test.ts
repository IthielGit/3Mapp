import { describe, expect, it } from "vitest";
import {
  dueOccurrences,
  indexAfter,
  occurrenceDate,
  type RecurrenceSpec,
} from "../../src/domain/recurrence";

const d = (y: number, m: number, day: number, h = 9) => new Date(y, m - 1, day, h, 0);
const monthly = { unit: "month" as const, interval: 1 };

function spec(
  partial: Partial<RecurrenceSpec> & Pick<RecurrenceSpec, "startDate">,
): RecurrenceSpec {
  return { frequency: monthly, dayOfMonthRule: "same_day", occurrenceIndex: 0, ...partial };
}

describe("calcul des occurrences", () => {
  it("mois court : le 31 janvier devient le 28 février puis revient le 31 mars", () => {
    const start = d(2026, 1, 31);
    expect(occurrenceDate(start, monthly, 1, "same_day")).toEqual(d(2026, 2, 28));
    expect(occurrenceDate(start, monthly, 2, "same_day")).toEqual(d(2026, 3, 31));
    expect(occurrenceDate(start, monthly, 3, "same_day")).toEqual(d(2026, 4, 30));
  });

  it("règle « dernier jour du mois »", () => {
    const start = d(2026, 1, 15);
    expect(occurrenceDate(start, monthly, 1, "last_day")).toEqual(d(2026, 2, 28));
    expect(occurrenceDate(start, monthly, 2, "last_day")).toEqual(d(2026, 3, 31));
  });

  it("année bissextile : février 2028 a 29 jours", () => {
    const start = d(2028, 1, 29);
    expect(occurrenceDate(start, monthly, 1, "last_day")).toEqual(d(2028, 2, 29));
    expect(occurrenceDate(start, monthly, 1, "same_day")).toEqual(d(2028, 2, 29));
  });

  it("année : 29 février ramené au 28 les années non bissextiles", () => {
    const start = d(2028, 2, 29);
    const yearly = { unit: "year" as const, interval: 1 };
    expect(occurrenceDate(start, yearly, 1, "same_day")).toEqual(d(2029, 2, 28));
    expect(occurrenceDate(start, yearly, 4, "same_day")).toEqual(d(2032, 2, 29));
  });

  it("semaines et intervalles", () => {
    const start = d(2026, 1, 1);
    expect(occurrenceDate(start, { unit: "week", interval: 2 }, 1, "same_day")).toEqual(
      d(2026, 1, 15),
    );
    expect(occurrenceDate(start, { unit: "month", interval: 3 }, 1, "same_day")).toEqual(
      d(2026, 4, 1),
    );
  });
});

describe("génération rattrapée à l’ouverture", () => {
  it("application fermée 3 mois : toutes les occurrences manquantes, une seule fois", () => {
    const s = spec({ startDate: d(2026, 1, 1).toISOString() });
    const now = d(2026, 4, 15);

    const first = dueOccurrences(s, now);
    expect(first).toHaveLength(4); // janvier, février, mars, avril
    expect(first.at(-1)).toEqual(d(2026, 4, 1));

    // Après génération, l'index avance : rien de plus n'est dû au même instant.
    const after = dueOccurrences({ ...s, occurrenceIndex: first.length }, now);
    expect(after).toHaveLength(0);
  });

  it("une date de fin coupe la génération", () => {
    const s = spec({
      startDate: d(2026, 1, 1).toISOString(),
      endDate: d(2026, 2, 15).toISOString(),
    });
    expect(dueOccurrences(s, d(2026, 12, 1))).toHaveLength(2);
  });

  it("reprise après pause : la première occurrence future devient la prochaine", () => {
    const s = {
      startDate: d(2026, 1, 1).toISOString(),
      frequency: monthly,
      dayOfMonthRule: "same_day" as const,
    };
    expect(indexAfter(s, d(2026, 4, 15))).toBe(4); // 1er mai est l'index 4
  });
});
