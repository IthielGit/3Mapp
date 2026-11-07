import { describe, expect, it } from "vitest";
import { relativeDay } from "../../src/domain/relative-day";

// Dates locales construites sans fuseau explicite : le test suit le fuseau de la machine, comme l'app.
const now = new Date(2026, 10, 7, 9, 30);

describe("relativeDay", () => {
  it("reconnaît aujourd'hui, même tôt le matin", () => {
    expect(relativeDay(new Date(2026, 10, 7, 0, 5).toISOString(), now)).toEqual({ kind: "today" });
  });

  it("reconnaît hier, même tard le soir", () => {
    expect(relativeDay(new Date(2026, 10, 6, 23, 55).toISOString(), now)).toEqual({ kind: "yesterday" });
  });

  it("donne la date au-delà d'hier", () => {
    const iso = new Date(2026, 10, 4, 14, 30).toISOString();
    const result = relativeDay(iso, now);
    expect(result.kind).toBe("date");
    expect(result.kind === "date" && result.date.getDate()).toBe(4);
  });

  it("donne la date pour une transaction future", () => {
    expect(relativeDay(new Date(2026, 10, 8, 8, 0).toISOString(), now).kind).toBe("date");
  });
});
