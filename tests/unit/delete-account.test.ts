import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppDatabase } from "../../src/db/database";
import { deleteOwnAccount } from "../../src/features/account/delete-account";

const ID = "33333333-3333-4333-8333-333333333333";

function fakeClient(rpcError: { message: string } | null) {
  const signOut = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async () => ({ data: null, error: rpcError }));
  const client = { rpc, auth: { signOut } } as unknown as SupabaseClient;
  return { client, rpc, signOut };
}

let db: AppDatabase;

beforeEach(async () => {
  db = new AppDatabase(`delete-test-${Math.random().toString(36).slice(2)}`);
  await db.reconciliations.put({
    id: ID,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    walletId: "44444444-4444-4444-8444-444444444444",
    date: "2026-01-02T00:00:00.000Z",
    realBalance: 1,
    computedBalance: 0,
    adjustment: 1,
    memo: "",
  });
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe("suppression de son propre compte", () => {
  it("sans réponse du serveur, rien n'est effacé sur l'appareil", async () => {
    const { client, signOut } = fakeClient({ message: "Failed to fetch" });
    const result = await deleteOwnAccount(client, db);
    expect(result).toEqual({ ok: false, code: "network" });
    expect(await db.reconciliations.count()).toBe(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("appelle la fonction serveur, efface l'appareil et termine la session", async () => {
    const { client, rpc, signOut } = fakeClient(null);
    const result = await deleteOwnAccount(client, db);
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_own_account");
    expect(await db.reconciliations.count()).toBe(0);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
