import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppDatabase } from "../../src/db/database";
import {

  isReadOnly,
  setReadOnly,
  setSyncTracking,
  withTrustedWrites,
} from "../../src/db/sync-tracking";
import { encodeRecord } from "../../src/features/sync/sync-records";
import { ensureSync, enableSync, runSync } from "../../src/features/sync/sync-engine";
import {
  ConsultError,
  endConsult,
  getConsult,
  hasLeftoverConsult,
  leaveConsultLocally,
  startConsult,
} from "../../src/features/admin/consult";
import { consultPull, setAccountRole, consultStart, deleteAuditEntries } from "../../src/features/admin/admin-service";
import { AdminError } from "../../src/features/admin/admin-service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_REC = "55555555-5555-4555-8555-555555555555";
const ADMIN_REC = "66666666-6666-4666-8666-666666666666";

function reconciliation(id: string, memo: string) {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    walletId: "44444444-4444-4444-8444-444444444444",
    date: "2026-01-02T00:00:00.000Z",
    realBalance: 1,
    computedBalance: 0,
    adjustment: 1,
    memo,
  };
}

/**
 * Faux serveur : compte consulté (`admin_consult_pull` renvoie ses lignes par pages),
 * compte de l'administrateur (`sync_records`, lu par la synchro), et les autres fonctions.
 */
function fakeServer(targetRows: Record<string, unknown>[], onRpc?: (fn: string, args: unknown) => void) {
  const rpc = vi.fn(async (fn: string, args?: unknown) => {
    onRpc?.(fn, args);
    switch (fn) {
      case "admin_consult_start":
        return { data: "target@example.be", error: null };
      case "admin_consult_pull":
        return { data: targetRows, error: null };
      default:
        return { data: null, error: null };
    }
  });
  const client = {
    rpc,
    from: vi.fn(() => ({
      select: () => ({
        gt: () => ({
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
    })),
  };
  return { client: client as unknown as SupabaseClient, rpc };
}

async function remoteRow(id: string, memo: string, table = "reconciliations"): Promise<Record<string, unknown>> {
  const record = reconciliation(id, memo) as unknown as Record<string, unknown>;
  const encoded = await encodeRecord(table as "reconciliations", record);
  if (!encoded.ok) throw new Error("encodage impossible");
  return {
    table_name: table,
    record_id: id,
    updated_at: record.updatedAt,
    deleted: false,
    data: encoded.data,
    changed_at: "2030-01-01T00:00:00.000Z",
  };
}

let db: AppDatabase;

beforeEach(async () => {
  db = new AppDatabase(`consult-test-${Math.random().toString(36).slice(2)}`);
  setReadOnly(false);
  setSyncTracking(false);
  window.sessionStorage.clear();
  await db.reconciliations.put(reconciliation(ADMIN_REC, "compte de l'administrateur") as never);
});

afterEach(async () => {
  // Remet à zéro l'état du module (consultation en cours) pour que chaque test parte de zéro.
  await leaveConsultLocally();
  setReadOnly(false);
  setSyncTracking(false);
  window.sessionStorage.clear();
  await db.delete();
});

describe("garde en lecture seule (base locale)", () => {
  it("refuse toute écriture sur une table synchronisée", async () => {
    setReadOnly(true);
    await expect(db.reconciliations.put(reconciliation(TARGET_REC, "x") as never)).rejects.toMatchObject({ name: "ReadOnlyError" });
    await expect(db.reconciliations.delete(ADMIN_REC)).rejects.toMatchObject({ name: "ReadOnlyError" });
    expect(await db.reconciliations.count()).toBe(1);
  });

  it("laisse passer les écritures de confiance, puis reprend la garde", async () => {
    setReadOnly(true);
    await withTrustedWrites(() => db.reconciliations.put(reconciliation(TARGET_REC, "ok") as never));
    expect(await db.reconciliations.get(TARGET_REC)).toBeDefined();
    await expect(db.reconciliations.put(reconciliation(ADMIN_REC, "refus") as never)).rejects.toMatchObject({ name: "ReadOnlyError" });
  });

  it("n'empêche rien quand la lecture seule est désactivée", async () => {
    await db.reconciliations.put(reconciliation(TARGET_REC, "libre") as never);
    expect(isReadOnly()).toBe(false);
    expect(await db.reconciliations.count()).toBe(2);
  });
});

describe("consultation", () => {
  it("charge le compte consulté, coupe la synchro de l'administrateur et passe en lecture seule", async () => {
    const { client, rpc } = fakeServer([await remoteRow(TARGET_REC, "du compte consulté")]);
    const email = await startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db);

    expect(email).toBe("target@example.be");
    expect(rpc).toHaveBeenCalledWith("admin_consult_start", { p_user: TARGET_ID });
    expect(isReadOnly()).toBe(true);
    expect(getConsult()).toEqual({ adminId: ADMIN_ID, targetId: TARGET_ID, email: "target@example.be" });
    expect(hasLeftoverConsult()).toBe(true);
    // Les données locales sont celles du compte consulté : celles de l'administrateur ont disparu.
    expect(await db.reconciliations.get(ADMIN_REC)).toBeUndefined();
    expect(await db.reconciliations.get(TARGET_REC)).toBeDefined();
    // La synchro de l'administrateur est arrêtée : aucune relance ne doit fusionner ces données vers son compte.
    expect((await db.syncState.get("state"))?.enabled).toBeFalsy();
  });

  it("refuse la modification pendant la consultation", async () => {
    const { client } = fakeServer([await remoteRow(TARGET_REC, "x")]);
    await startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db);
    await expect(
      db.reconciliations.put(reconciliation("77777777-7777-4777-8777-777777777777", "y") as never),
    ).rejects.toMatchObject({ name: "ReadOnlyError" });
  });

  it("ne synchronise rien pendant la consultation, même à la demande", async () => {
    const { client, rpc } = fakeServer([await remoteRow(TARGET_REC, "x")]);
    await startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db);
    rpc.mockClear();
    await runSync(client, db);
    await ensureSync(client, ADMIN_ID, db);
    expect(rpc).not.toHaveBeenCalledWith("sync_push_v2", expect.anything());
    await expect(enableSync(client, ADMIN_ID, "merge", db)).rejects.toThrow();
  });

  it("refuse d'ouvrir une consultation s'il reste des modifications non envoyées (sans confirmation)", async () => {
    await db.syncOutbox.put({ key: "reconciliations|x", table: "reconciliations", recordId: "x", op: "upsert", seq: 1, at: "2026-01-01T00:00:00.000Z" });
    const { client, rpc } = fakeServer([]);
    await expect(startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db)).rejects.toBeInstanceOf(ConsultError);
    expect(rpc).not.toHaveBeenCalledWith("admin_consult_start", expect.anything());
    expect(await db.reconciliations.get(ADMIN_REC)).toBeDefined();
  });

  it("ne touche pas aux données de l'administrateur si la lecture du compte consulté échoue", async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === "admin_consult_start") return { data: "target@example.be", error: null };
      return { data: null, error: { message: "network down" } };
    });
    const client = { rpc, from: vi.fn() } as unknown as SupabaseClient;
    await expect(startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db)).rejects.toBeDefined();
    expect(isReadOnly()).toBe(false);
    expect(getConsult()).toBeUndefined();
    expect(await db.reconciliations.get(ADMIN_REC)).toBeDefined();
  });

  it("ferme la consultation : journal, retour aux données de l'administrateur, lecture seule levée", async () => {
    const { client, rpc } = fakeServer([await remoteRow(TARGET_REC, "x")]);
    await startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db);
    await endConsult(client, ADMIN_ID, db);

    expect(rpc).toHaveBeenCalledWith("admin_consult_end", { p_user: TARGET_ID });
    expect(isReadOnly()).toBe(false);
    expect(getConsult()).toBeUndefined();
    expect(hasLeftoverConsult()).toBe(false);
    expect(await db.reconciliations.get(TARGET_REC)).toBeUndefined();
    expect((await db.syncState.get("state"))?.userId).toBe(ADMIN_ID);
    expect((await db.syncState.get("state"))?.enabled).toBe(true);
  });

  it("sortie forcée : lève la lecture seule et sort de la consultation sans réseau", async () => {
    const { client, rpc } = fakeServer([await remoteRow(TARGET_REC, "x")]);
    await startConsult(client, ADMIN_ID, TARGET_ID, { discardUnsent: false }, db);
    await leaveConsultLocally(client);
    expect(isReadOnly()).toBe(false);
    expect(getConsult()).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("admin_consult_end", { p_user: TARGET_ID });
  });
});

describe("service d'administration : rôles et consultation", () => {
  function rpcOnly(response: { data?: unknown; error?: { code?: string; message?: string } | null }) {
    const rpc = vi.fn(async () => ({ data: response.data ?? null, error: response.error ?? null }));
    return { client: { rpc } as unknown as SupabaseClient, rpc };
  }

  it("transmet le changement de rôle", async () => {
    const { client, rpc } = rpcOnly({});
    await setAccountRole(client, TARGET_ID, "super_admin");
    expect(rpc).toHaveBeenCalledWith("admin_set_role", { p_user: TARGET_ID, p_role: "super_admin" });
  });

  it("classe les refus de rôle (compte propre, dernier super administrateur)", async () => {
    await expect(setAccountRole(rpcOnly({ error: { message: "cannot change own role" } }).client, ADMIN_ID, "user")).rejects.toMatchObject({
      code: "selfAction",
    });
    await expect(
      setAccountRole(rpcOnly({ error: { message: "at least one super admin is required" } }).client, TARGET_ID, "user"),
    ).rejects.toMatchObject({ code: "lastSuperAdmin" });
  });

  it("renvoie l'e-mail du compte consulté, et refuse une réponse vide", async () => {
    await expect(consultStart(rpcOnly({ data: "a@b.be" }).client, TARGET_ID)).resolves.toBe("a@b.be");
    await expect(consultStart(rpcOnly({ data: null }).client, TARGET_ID)).rejects.toBeInstanceOf(AdminError);
  });

  it("supprime des entrées du journal via la fonction du super administrateur", async () => {
    const { client, rpc } = rpcOnly({ data: 2 });
    await expect(deleteAuditEntries(client, [4, 9])).resolves.toBe(2);
    expect(rpc).toHaveBeenCalledWith("admin_audit_delete", { p_ids: [4, 9] });
  });

  it("lit les pages avec un curseur complet (changed_at, table, identifiant)", async () => {
    const { client, rpc } = rpcOnly({ data: [] });
    await consultPull(client, TARGET_ID, { changedAt: "2030-01-01T00:00:00.000Z", table: "wallets", record: "w1" });
    expect(rpc).toHaveBeenCalledWith("admin_consult_pull", {
      p_user: TARGET_ID,
      p_after: "2030-01-01T00:00:00.000Z",
      p_after_table: "wallets",
      p_after_record: "w1",
      p_limit: 500,
    });
  });
});
