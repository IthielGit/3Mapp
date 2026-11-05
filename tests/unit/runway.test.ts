import { describe, expect, it } from "vitest";
import { runwayDays } from "../../src/domain/cycle";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 2, 20, 12);
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY).toISOString();

describe("« Je tiens X jours » (runwayDays)", () => {
  it("aucune dépense saisie : rien à estimer", () => {
    expect(runwayDays(500_000, [], now)).toBeNull();
  });

  it("disponible ÷ dépense moyenne par jour, sur l'historique disponible", () => {
    // 10 jours d'historique, 100 000 dépensés : 10 000 par jour. 300 000 couvrent 30 jours.
    const r = runwayDays(300_000, [{ amount: 100_000, date: daysAgo(10) }], now);
    expect(r).toEqual({ days: 30, confidence: "fragile" });
  });

  it("historique de plus de 30 jours : fenêtre de 30 jours, fiabilité solide", () => {
    const expenses = [
      { amount: 30_000, date: daysAgo(40) }, // hors fenêtre, ignorée
      { amount: 30_000, date: daysAgo(5) },
      { amount: 30_000, date: daysAgo(30) },
    ];
    const r = runwayDays(60_000, expenses, now);
    // 60 000 sur 30 jours = 2 000 par jour ; 60 000 couvrent 30 jours.
    expect(r).toEqual({ days: 30, confidence: "solid" });
  });

  it("historique entre 14 et 30 jours : « à peu près »", () => {
    const r = runwayDays(100_000, [{ amount: 20_000, date: daysAgo(20) }], now);
    expect(r?.confidence).toBe("approx");
  });

  it("disponible nul ou négatif : 0 jour", () => {
    expect(runwayDays(0, [{ amount: 20_000, date: daysAgo(3) }], now)?.days).toBe(0);
    expect(runwayDays(-50_000, [{ amount: 20_000, date: daysAgo(3) }], now)?.days).toBe(0);
  });
});
