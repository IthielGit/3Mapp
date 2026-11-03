import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { attemptPin, setPin } from "../../src/features/security/security-service";

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
  await setPin("482615", undefined, db);
});

afterEach(async () => {
  await db.delete();
});

describe("déverrouillage par PIN", () => {
  it("le bon PIN déverrouille", async () => {
    expect(await attemptPin("482615", new Date(), db)).toEqual({ ok: true });
  });

  it("trois mauvais essais : le troisième verrouille pour 30 s", async () => {
    const now = new Date(2026, 0, 1, 12);
    expect(await attemptPin("111111", now, db)).toEqual({
      ok: false,
      reason: "wrong",
      retryInSeconds: 0,
    });
    expect(await attemptPin("111111", now, db)).toEqual({
      ok: false,
      reason: "wrong",
      retryInSeconds: 0,
    });
    const third = await attemptPin("111111", now, db);
    expect(third).toEqual({ ok: false, reason: "locked", retryInSeconds: 30 });

    // Même le bon PIN est refusé pendant la temporisation.
    const during = await attemptPin("482615", new Date(now.getTime() + 5000), db);
    expect(during.ok).toBe(false);
  });

  it("après la temporisation, le bon PIN fonctionne de nouveau", async () => {
    const now = new Date(2026, 0, 1, 12);
    for (let i = 0; i < 3; i++) await attemptPin("111111", now, db);
    expect(await attemptPin("482615", new Date(now.getTime() + 31_000), db)).toEqual({ ok: true });
  });
});
