import { describe, expect, it } from "vitest";
import { accountingMonth, periodFor, splitPeriods } from "../../src/domain/period";

const DAY = 24 * 60 * 60 * 1000;

describe("cycle de paie : vendredi quand le jour tombe un week-end", () => {
  it("un samedi avance le début au vendredi, un dimanche à l'avant-veille (vendredi)", () => {
    for (let month = 0; month < 12; month++) {
      const payday = new Date(2026, month, 28);
      const anchor = new Date(2026, month, 28, 12);
      const period = accountingMonth(anchor, 28, true);
      const weekday = payday.getDay();
      const expectedFrom =
        weekday === 6 ? 27 : weekday === 0 ? 26 : 28;
      expect(period.from.getDate()).toBe(expectedFrom);
      expect(period.from.getMonth()).toBe(month);
    }
  });

  it("sans l'option, le cycle commence le jour demandé même un week-end", () => {
    const period = accountingMonth(new Date(2026, 2, 30, 12), 28, false);
    expect(period.from.getDate()).toBe(28);
  });

  it("le 1er n'est jamais avancé (mois civil)", () => {
    for (let month = 0; month < 12; month++) {
      const period = accountingMonth(new Date(2026, month, 15, 12), 1, true);
      expect(period.from.getDate()).toBe(1);
    }
  });

  it("les cycles se suivent sans trou ni chevauchement, sur 2024 à 2030, pour tous les jours de paie", () => {
    for (const startDay of [2, 5, 15, 27, 28, 29, 30, 31]) {
      for (const payOnFriday of [false, true]) {
        for (let t = new Date(2024, 0, 1).getTime(); t < new Date(2030, 11, 31).getTime(); t += DAY) {
          const anchor = new Date(t + 12 * 60 * 60 * 1000);
          const p = accountingMonth(anchor, startDay, payOnFriday);
          expect(anchor.getTime() >= p.from.getTime() && anchor.getTime() < p.to.getTime()).toBe(true);
          const next = accountingMonth(p.to, startDay, payOnFriday);
          expect(next.from.getTime()).toBe(p.to.getTime());
        }
      }
    }
  });

  it("splitPeriods découpe une année en cycles entiers avec l'option", () => {
    const settings = { monthStartDay: 28, weekStartDay: 1, payOnFriday: true };
    const year = periodFor("year", new Date(2026, 5, 1), settings);
    const cycles = splitPeriods(year, "month", settings);
    expect(cycles.length).toBeGreaterThanOrEqual(12);
    for (let i = 1; i < cycles.length; i++) {
      const cur = cycles[i];
      const prev = cycles[i - 1];
      if (cur && prev) expect(cur.from.getTime()).toBe(prev.to.getTime());
    }
  });
});
