import { describe, expect, it } from "vitest";
import { backupReminder } from "../../src/domain/backup";
import { payStatus } from "../../src/domain/cycle";
import { accountingMonth } from "../../src/domain/period";

const DAY = 24 * 60 * 60 * 1000;

describe("carte d'accueil : rappel de sauvegarde", () => {
  const now = new Date(2026, 10, 5, 12);
  it("pas de rappel dans les 7 premiers jours d'usage", () => {
    expect(backupReminder(undefined, now, true, new Date(now.getTime() - 2 * DAY).toISOString())).toBe("none");
  });
  it("rappel une fois les 7 jours passés sans sauvegarde", () => {
    expect(backupReminder(undefined, now, true, new Date(now.getTime() - 10 * DAY).toISOString())).toBe("never");
  });
});

describe("carte d'accueil : retard de paie", () => {
  const PAY = "00000000-0000-4000-8000-0000000000pp";
  const period = accountingMonth(new Date(2026, 2, 10, 12), 28, true);
  it("pas de retard sans paie précédente : la paie est seulement attendue", () => {
    expect(payStatus([], PAY, period, new Date(2026, 2, 3, 12)).kind).toBe("expected");
  });
});
