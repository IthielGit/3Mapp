import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { updatePreferences } from "../../src/features/settings/preferences-service";
import { localDayKey, reminderDue } from "../../src/domain/reminder";
import { computeBalances } from "../../src/domain/balance";
import type { Transaction, Wallet } from "../../src/db/entities";

let db: AppDatabase;

beforeEach(async () => {
  db = new AppDatabase(`test-${crypto.randomUUID()}`);
  await completeOnboarding(
    {
      language: "fr",
      baseCurrency: "MGA",
      wallet: {
        name: "Compte",
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 0,
      },
    },
    db,
  );
});

afterEach(async () => {
  await db.delete();
});

describe("rappel quotidien", () => {
  const at = (h: number, m: number) => new Date(2026, 10, 4, h, m);

  it("désactivé : jamais dû", () => {
    expect(reminderDue({ enabled: false, time: "08:00", lastDay: undefined }, at(9, 0))).toBe(
      false,
    );
  });

  it("dû après l'heure, une seule fois par jour", () => {
    const state = { enabled: true, time: "08:00", lastDay: undefined };
    expect(reminderDue(state, at(7, 59))).toBe(false);
    expect(reminderDue(state, at(8, 0))).toBe(true);
    expect(reminderDue({ ...state, lastDay: localDayKey(at(8, 0)) }, at(20, 0))).toBe(false);
  });

  it("heure invalide : jamais dû", () => {
    expect(reminderDue({ enabled: true, time: "25:00", lastDay: undefined }, at(9, 0))).toBe(false);
  });
});

describe("ignorer le solde futur", () => {
  const wallet: Pick<Wallet, "id" | "initialBalance"> = { id: "w1", initialBalance: 1000 };
  const tx = (date: string, amount: number): Transaction =>
    ({
      id: date,
      type: "income",
      amount,
      currency: "MGA",
      walletId: "w1",
      memo: "",
      attachmentIds: [],
      date,
      status: "posted",
      createdAt: date,
      updatedAt: date,
    }) as Transaction;

  it("sans date de coupure : toutes les transactions comptent", () => {
    const txs = [tx("2026-11-01T10:00:00.000Z", 100), tx("2026-12-01T10:00:00.000Z", 500)];
    expect(computeBalances([wallet], txs)["w1"]).toBe(1600);
  });

  it("avec date de coupure : les transactions futures sont exclues", () => {
    const txs = [tx("2026-11-01T10:00:00.000Z", 100), tx("2026-12-01T10:00:00.000Z", 500)];
    expect(computeBalances([wallet], txs, new Date("2026-11-04T00:00:00.000Z"))["w1"]).toBe(1100);
  });
});

describe("préférences", () => {
  it("enregistre langue, jours et touche zéros", async () => {
    await updatePreferences(
      { language: "en", weekStartDay: 0, monthStartDay: 15, keypadZeros: 2 },
      db,
    );
    const s = await db.settings.toCollection().first();
    expect(s?.language).toBe("en");
    expect(s?.weekStartDay).toBe(0);
    expect(s?.monthStartDay).toBe(15);
    expect(s?.keypadZeros).toBe(2);
  });

  it("refuse un jour de mois au-delà de 28 (même règle que le schéma)", async () => {
    await expect(updatePreferences({ monthStartDay: 31 }, db)).rejects.toThrow();
  });

  it("refuse une heure de rappel invalide", async () => {
    await expect(updatePreferences({ reminderTime: "9h" }, db)).rejects.toThrow();
  });
});
