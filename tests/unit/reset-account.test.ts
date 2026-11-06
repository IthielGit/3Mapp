import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppDatabase } from "../../src/db/database";
import { setReadOnly } from "../../src/db/sync-tracking";
import { resetAccount } from "../../src/features/settings/reset-account";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`reset-${crypto.randomUUID()}`);
});

afterEach(async () => {
  setReadOnly(false);
  await db.delete();
});

async function seedWallet() {
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
}

/** Faux client : enregistre la suppression demandée sur sync_records et renvoie l'erreur donnée. */
function fakeClient(error: { code?: string; message: string } | null = null) {
  const eq = vi.fn(async () => ({ error }));
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return { client: { from } as unknown as SupabaseClient, from, del, eq };
}

describe("resetAccount", () => {
  it("vide toutes les tables, réglages compris", async () => {
    await db.settings.add({
      id: "s1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      baseCurrency: "MGA",
    } as never);
    await seedWallet();

    expect(await db.wallets.count()).toBe(1);
    await resetAccount(db);

    for (const table of db.tables) {
      expect(await table.count(), table.name).toBe(0);
    }
  });

  it("efface aussi les données du compte sur le serveur", async () => {
    await seedWallet();
    const fake = fakeClient();

    await resetAccount(db, { client: fake.client, userId: "user-1" });

    expect(fake.from).toHaveBeenCalledWith("sync_records");
    expect(fake.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(await db.wallets.count()).toBe(0);
  });

  it("ne supprime rien en local si l'effacement serveur échoue", async () => {
    await seedWallet();
    const fake = fakeClient({ code: "42501", message: "permission denied" });

    await expect(resetAccount(db, { client: fake.client, userId: "user-1" })).rejects.toMatchObject({
      code: "suspended",
    });
    expect(await db.wallets.count()).toBe(1);
  });

  it("refuse l'effacement serveur pendant une consultation (lecture seule)", async () => {
    await seedWallet();
    const fake = fakeClient();
    setReadOnly(true);

    await expect(resetAccount(db, { client: fake.client, userId: "user-1" })).rejects.toBeInstanceOf(Error);
    expect(fake.from).not.toHaveBeenCalled();
    expect(await db.wallets.count()).toBe(1);
  });
});
