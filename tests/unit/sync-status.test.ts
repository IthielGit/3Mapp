import { describe, expect, it } from "vitest";
import {
  INITIAL_ANNOUNCE_MEMORY,
  nextSyncAnnouncement,
  syncAgo,
  syncStatusLine,
  type SyncAnnounceMemory,
  type SyncStatusInput,
  type SyncStatusLine,
} from "../../src/domain/sync-status";

const NOW = new Date("2026-11-07T12:00:00Z");

function input(over: Partial<SyncStatusInput> = {}): SyncStatusInput {
  return {
    signedIn: true,
    online: true,
    busy: false,
    pending: 0,
    error: undefined,
    lastSyncAt: "2026-11-07T11:58:00Z",
    now: NOW,
    ...over,
  };
}

describe("ligne d'état de la synchro", () => {
  it("à jour, avec l'ancienneté de la dernière synchro", () => {
    expect(syncStatusLine(input())).toEqual({ kind: "upToDate", ago: { unit: "minutes", value: 2 } });
    expect(syncStatusLine(input({ lastSyncAt: undefined }))).toEqual({ kind: "upToDate", ago: undefined });
  });

  it("hors ligne passe avant tout, avec les envois en attente", () => {
    expect(syncStatusLine(input({ online: false, pending: 3, busy: true, error: "network" }))).toEqual({
      kind: "offline",
      pending: 3,
    });
  });

  it("sans compte : rien en ligne, « enregistré ici » hors ligne", () => {
    expect(syncStatusLine(input({ signedIn: false, pending: 2 }))).toEqual({ kind: "hidden" });
    expect(syncStatusLine(input({ signedIn: false, online: false, pending: 2 }))).toEqual({
      kind: "offline",
      pending: 0,
    });
  });

  it("synchro en cours, puis erreur, puis envois en attente", () => {
    expect(syncStatusLine(input({ busy: true, error: "unknown", pending: 1 })).kind).toBe("syncing");
    expect(syncStatusLine(input({ error: "suspended", pending: 1 }))).toEqual({
      kind: "error",
      code: "suspended",
      pending: 1,
    });
    expect(syncStatusLine(input({ pending: 4 }))).toEqual({ kind: "pending", pending: 4 });
  });

  it("un code d'erreur inconnu devient « unknown »", () => {
    expect(syncStatusLine(input({ error: "boom" }))).toEqual({ kind: "error", code: "unknown", pending: 0 });
  });

  it("arrondit l'ancienneté", () => {
    expect(syncAgo("2026-11-07T11:59:30Z", NOW)).toEqual({ unit: "now" });
    expect(syncAgo("2026-11-07T12:05:00Z", NOW)).toEqual({ unit: "now" });
    expect(syncAgo("2026-11-07T11:00:59Z", NOW)).toEqual({ unit: "minutes", value: 59 });
    expect(syncAgo("2026-11-07T09:30:00Z", NOW)).toEqual({ unit: "hours", value: 2 });
    expect(syncAgo("2026-11-04T11:00:00Z", NOW)).toEqual({ unit: "days", value: 3 });
    expect(syncAgo("pas une date", NOW)).toBeUndefined();
  });
});

describe("annonces de la synchro", () => {
  function run(lines: SyncStatusLine[]): (string | undefined)[] {
    let memory: SyncAnnounceMemory = INITIAL_ANNOUNCE_MEMORY;
    return lines.map((line) => {
      const next = nextSyncAnnouncement(memory, line);
      memory = next.memory;
      return next.announce;
    });
  }
  const upToDate: SyncStatusLine = { kind: "upToDate", ago: { unit: "now" } };
  const offline: SyncStatusLine = { kind: "offline", pending: 1 };
  const pending: SyncStatusLine = { kind: "pending", pending: 1 };
  const error: SyncStatusLine = { kind: "error", code: "unknown", pending: 0 };

  it("le premier état n'est pas annoncé", () => {
    expect(run([offline])).toEqual([undefined]);
    expect(run([error])).toEqual([undefined]);
  });

  it("hors ligne, puis retour annoncé seulement après la synchro réussie", () => {
    expect(run([upToDate, offline, offline, pending, upToDate, upToDate])).toEqual([
      undefined,
      "offline",
      undefined,
      undefined,
      "restored",
      undefined,
    ]);
  });

  it("une erreur est annoncée une fois, puis de nouveau si elle revient après un succès", () => {
    expect(run([upToDate, error, error, pending, error, upToDate, error])).toEqual([
      undefined,
      "error",
      undefined,
      undefined,
      undefined,
      undefined,
      "error",
    ]);
  });

  it("après une synchro manuelle, le bouton a déjà annoncé le résultat", () => {
    expect(run([upToDate, { kind: "syncing" }, error])).toEqual([undefined, undefined, undefined]);
    expect(run([upToDate, offline, { kind: "syncing" }, upToDate])).toEqual([
      undefined,
      "offline",
      undefined,
      undefined,
    ]);
  });

  it("l'horloge qui avance ne déclenche rien", () => {
    expect(
      run([upToDate, { kind: "upToDate", ago: { unit: "minutes", value: 1 } }, { kind: "upToDate", ago: undefined }]),
    ).toEqual([undefined, undefined, undefined]);
  });
});
