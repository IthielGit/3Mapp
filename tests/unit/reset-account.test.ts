import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { resetAccount } from "../../src/features/settings/reset-account";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`reset-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("resetAccount", () => {
  it("vide toutes les tables, réglages compris", async () => {
    await db.settings.add({
      id: "s1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      baseCurrency: "MGA",
    } as never);
    await db.wallets.add({
      id: "w1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      name: "BNI",
      icon: "🏦",
      color: "#000000",
      currency: "MGA",
      initialBalance: 0,
      sortOrder: 0,
      includeInTotal: true,
      group: "bank",
      archived: false,
    } as never);

    expect(await db.wallets.count()).toBe(1);
    await resetAccount(db);

    for (const table of db.tables) {
      expect(await table.count(), table.name).toBe(0);
    }
  });
});
