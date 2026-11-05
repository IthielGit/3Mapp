import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppDatabase } from "../../src/db/database";
import { discardPending, setSyncTracking } from "../../src/db/sync-tracking";
import { disableSync, enableSync, ensureSync, runSync } from "../../src/features/sync/sync-engine";
import { decodeRecord, encodeRecord } from "../../src/features/sync/sync-records";

type Row = Record<string, unknown>;

/**
 * Faux serveur sync_records : `sync_push` applique « le plus récent gagne » comme la fonction SQL,
 * et la lecture renvoie les lignes modifiées après le curseur, comme la requête PostgREST.
 */
function fakeServer(initial: Row[] = []) {
  const rows = new Map<string, Row>();
  let tick = 0;
  const stamp = () => new Date(Date.parse("2030-01-01T00:00:00.000Z") + ++tick * 1000).toISOString();
  for (const row of initial) rows.set(`${row.table_name}|${row.record_id}`, { ...row, changed_at: stamp() });
  const pushes: Row[][] = [];

  const client = {
    rpc: vi.fn(async (_fn: string, args: { p_records: Row[] }) => {
      pushes.push(args.p_records);
      for (const incoming of args.p_records) {
        const key = `${incoming.table_name}|${incoming.record_id}`;
        const current = rows.get(key);
        if (current && Date.parse(String(incoming.updated_at)) <= Date.parse(String(current.updated_at))) continue;
        rows.set(key, { ...incoming, changed_at: stamp() });
      }
      return { data: args.p_records.length, error: null };
    }),
    from: vi.fn(() => ({
      select: (_columns: string, options?: { head?: boolean }) => {
        if (options?.head) return Promise.resolve({ count: rows.size, error: null });
        let since = "";
        const builder = {
          gt: (_column: string, value: string) => {
            since = value;
            return builder;
          },
          order: () => builder,
          limit: async (n: number) => ({
            data: [...rows.values()]
              .filter((row) => String(row.changed_at) > since)
              .sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)))
              .slice(0, n),
            error: null,
          }),
        };
        return builder;
      },
    })),
  };
  return { client: client as unknown as SupabaseClient, rows, pushes };
}

const USER = "22222222-2222-4222-8222-222222222222";

/** Réconciliation : enregistrement sans binaire, adapté aux tests du moteur (IndexedDB de test ne garde pas les Blob). */
function recon(id: string, updatedAt: string, memo = "test") {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    walletId: "44444444-4444-4444-8444-444444444444",
    date: "2026-01-02T00:00:00.000Z",
    realBalance: 100,
    computedBalance: 90,
    adjustment: 10,
    memo,
  };
}

/** Pièce jointe avec binaire : utilisée seulement par le test de codage (vrai Blob). */
function attachment(id: string, updatedAt: string, text = "abc") {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    mime: "text/plain",
    name: "note.txt",
    size: text.length,
    blob: new Blob([text], { type: "text/plain" }),
  };
}

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`sync-test-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  setSyncTracking(false);
  discardPending();
  db.close();
  await db.delete();
});

describe("codage des enregistrements", () => {
  it("encode une pièce jointe en base64 et la restitue à l'identique", async () => {
    const record = attachment("33333333-3333-4333-8333-333333333333", "2026-01-02T00:00:00.000Z", "bonjour");
    const encoded = await encodeRecord("attachments", record as unknown as Record<string, unknown>);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.data).not.toHaveProperty("blob");
    expect(typeof encoded.data.blobBase64).toBe("string");

    const decoded = await decodeRecord("attachments", encoded.data);
    expect(decoded).toBeDefined();
    const blob = decoded?.blob as Blob;
    expect(await blob.text()).toBe("bonjour");
  });

  it("refuse une donnée qui ne respecte pas le schéma de sa table", async () => {
    expect(await decodeRecord("attachments", { id: "pas-un-uuid" })).toBeUndefined();
  });
});

describe("envoi et réception", () => {
  it("envoie une modification locale puis vide la file", async () => {
    const server = fakeServer();
    await enableSync(server.client, USER, "merge", db);

    await db.reconciliations.put(recon("33333333-3333-4333-8333-333333333333", "2026-01-02T00:00:00.000Z"));
    const report = await runSync(server.client, db);

    expect(report.pushed).toBe(1);
    expect(await db.syncOutbox.count()).toBe(0);
    const row = server.rows.get("reconciliations|33333333-3333-4333-8333-333333333333");
    expect(row?.deleted).toBe(false);
    expect((row?.data as Row).memo).toBe("test");
  });

  it("envoie une suppression sous forme de pierre tombale", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const server = fakeServer();
    await enableSync(server.client, USER, "merge", db);
    await db.reconciliations.put(recon(id, "2026-01-02T00:00:00.000Z"));
    await runSync(server.client, db);

    await db.reconciliations.delete(id);
    await runSync(server.client, db);

    expect(server.rows.get(`reconciliations|${id}`)?.deleted).toBe(true);
    expect(await db.reconciliations.count()).toBe(0);
  });

  it("reçoit les changements distants sans les renvoyer (pas d'écho)", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const remote = recon(id, "2026-01-05T00:00:00.000Z", "distant");
    const server = fakeServer([
      {
        table_name: "reconciliations",
        record_id: id,
        updated_at: "2026-01-05T00:00:00.000Z",
        deleted: false,
        data: remote,
      },
    ]);

    await enableSync(server.client, USER, "remote", db);

    expect(await db.reconciliations.get(id)).toBeDefined();
    expect(await db.syncOutbox.count()).toBe(0);
    expect(server.pushes.flat()).toHaveLength(0);
  });

  it("ne supprime pas un enregistrement modifié localement après la suppression distante", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    const server = fakeServer([
      {
        table_name: "reconciliations",
        record_id: id,
        updated_at: "2026-01-02T00:00:00.000Z",
        deleted: true,
        data: null,
      },
    ]);
    await db.reconciliations.put(recon(id, "2026-01-09T00:00:00.000Z"));
    setSyncTracking(false);
    await enableSync(server.client, USER, "merge", db);

    expect(await db.reconciliations.get(id)).toBeDefined();
  });

  it("conserve les réglages propres à l'appareil (PIN) quand le compte apporte un thème", async () => {
    const localId = "66666666-6666-4666-8666-666666666666";
    await db.settings.put({
      id: localId,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      baseCurrency: "MGA",
      monthStartDay: 1,
      weekStartDay: 1,
      language: "fr",
      theme: "light",
      pinHash: "hash-local",
      pinSalt: "sel-local",
    });
    const server = fakeServer([
      {
        table_name: "settings",
        record_id: "settings",
        updated_at: "2026-02-01T00:00:00.000Z",
        deleted: false,
        data: {
          id: "77777777-7777-4777-8777-777777777777",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
          baseCurrency: "MGA",
          monthStartDay: 1,
          weekStartDay: 1,
          language: "fr",
          theme: "dark",
        },
      },
    ]);

    await enableSync(server.client, USER, "remote", db);

    const local = await db.settings.get(localId);
    expect(local?.theme).toBe("dark");
    expect(local?.pinHash).toBe("hash-local");
    expect(local?.id).toBe(localId);
    expect(await db.settings.count()).toBe(1);
  });

  it("ne synchronise rien quand la synchro est désactivée", async () => {
    const server = fakeServer();
    await enableSync(server.client, USER, "merge", db);
    await disableSync(db);

    await db.reconciliations.put(recon("33333333-3333-4333-8333-333333333333", "2026-01-02T00:00:00.000Z"));
    const report = await runSync(server.client, db);

    expect(report.pushed).toBe(0);
    expect(await db.syncOutbox.count()).toBe(0);
    expect(server.rows.size).toBe(0);
  });
});

describe("synchronisation du compte connecté", () => {
  it("la première fois fusionne avec la base du compte, ensuite relance seulement", async () => {
    const server = fakeServer();
    await ensureSync(server.client, USER, db);
    expect((await db.syncState.get("state"))?.enabled).toBe(true);

    await db.reconciliations.put(recon("33333333-3333-4333-8333-333333333333", "2026-01-02T00:00:00.000Z"));
    const report = await ensureSync(server.client, USER, db);
    expect(report.pushed).toBe(1);
    expect(server.rows.has("reconciliations|33333333-3333-4333-8333-333333333333")).toBe(true);
  });
});
