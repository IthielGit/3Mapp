import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { setSyncTracking } from "../../src/db/sync-tracking";
import { createBackup, prepareRestore, restoreBackup } from "../../src/features/backup/backup-service";

const ID = "33333333-3333-4333-8333-333333333333";
const OLD = "2026-01-02T00:00:00.000Z";

function recon(updatedAt: string) {
  return {
    id: ID,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    walletId: "44444444-4444-4444-8444-444444444444",
    date: "2026-01-02T00:00:00.000Z",
    realBalance: 100,
    computedBalance: 90,
    adjustment: 10,
    memo: "sauvegardé",
  };
}

afterEach(() => setSyncTracking(false));

describe("restauration et synchro", () => {
  it("avec synchro active, le remplacement est refusé et n'efface rien", async () => {
    const source = new AppDatabase(`restore-src-${Math.random().toString(36).slice(2)}`);
    await source.reconciliations.put(recon(OLD));
    const prepared = prepareRestore(await createBackup(source));
    source.close();
    await source.delete();

    const target = new AppDatabase(`restore-dst-${Math.random().toString(36).slice(2)}`);
    await target.reconciliations.put({ ...recon(OLD), id: "55555555-5555-4555-8555-555555555555" });
    setSyncTracking(true);
    await expect(restoreBackup(prepared, "replace", target)).rejects.toThrow("remplacement");
    setSyncTracking(false);

    expect(await target.reconciliations.count()).toBe(1);
    expect(await target.reconciliations.get(ID)).toBeUndefined();
    target.close();
    await target.delete();
  });

  it("sans synchro, la restauration garde les dates du fichier", async () => {
    const source = new AppDatabase(`restore-src-${Math.random().toString(36).slice(2)}`);
    await source.reconciliations.put(recon(OLD));
    const prepared = prepareRestore(await createBackup(source));
    source.close();
    await source.delete();

    const target = new AppDatabase(`restore-dst-${Math.random().toString(36).slice(2)}`);
    await restoreBackup(prepared, "replace", target);
    expect((await target.reconciliations.get(ID))?.updatedAt).toBe(OLD);
    target.close();
    await target.delete();
  });
});
