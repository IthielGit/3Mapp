import { describe, expect, it } from "vitest";
import {
  SETTINGS_DEVICE_FIELDS,
  chunk,
  deviceOwnership,
  outboxKey,
  overlapSince,
  shouldApplyRemote,
  shouldApplyTombstone,
  stripDeviceFields,
} from "../../src/domain/sync";
import { TABLE_NAMES } from "../../src/features/backup/backup-format";
import { SYNCED_TABLES } from "../../src/db/sync-tracking";

describe("règles de fusion (le plus récent gagne)", () => {
  it("applique une version distante absente localement ou strictement plus récente", () => {
    expect(shouldApplyRemote(undefined, "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(shouldApplyRemote({ updatedAt: "2026-01-01T00:00:00.000Z" }, "2026-01-02T00:00:00.000Z")).toBe(true);
  });

  it("garde la version locale si elle est plus récente ou égale", () => {
    expect(shouldApplyRemote({ updatedAt: "2026-01-02T00:00:00.000Z" }, "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(shouldApplyRemote({ updatedAt: "2026-01-01T00:00:00.000Z" }, "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("applique une suppression distante seulement si elle n'est pas antérieure à la dernière modification locale", () => {
    const local = { updatedAt: "2026-01-02T00:00:00.000Z" };
    expect(shouldApplyTombstone(local, "2026-01-03T00:00:00.000Z")).toBe(true);
    expect(shouldApplyTombstone(local, "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(shouldApplyTombstone(undefined, "2026-01-03T00:00:00.000Z")).toBe(false);
  });
});

describe("réglages propres à l'appareil", () => {
  it("retire le PIN, la biométrie et les autres champs de l'appareil avant envoi", () => {
    const stripped = stripDeviceFields({
      id: "a",
      theme: "dark",
      pinHash: "h",
      pinSalt: "s",
      pinFailures: 2,
      biometricCredentialId: "c",
      autoLockSeconds: 60,
    });
    expect(stripped).toEqual({ id: "a", theme: "dark" });
    for (const field of SETTINGS_DEVICE_FIELDS) expect(stripped).not.toHaveProperty(field);
  });
});

describe("lots et curseur", () => {
  it("découpe en lots de taille fixe, en gardant le reste", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });

  it("recule le curseur de quelques secondes pour relire les lignes voisines", () => {
    expect(overlapSince("2026-01-01T00:00:10.000Z")).toBe("2026-01-01T00:00:05.000Z");
  });

  it("clé de file stable par table et identifiant", () => {
    expect(outboxKey("wallets", "w1")).toBe("wallets|w1");
  });
});

describe("liste des tables suivies", () => {
  it("couvre exactement les tables de sauvegarde", () => {
    expect([...SYNCED_TABLES].sort()).toEqual([...TABLE_NAMES].sort());
  });
});

describe("propriété des données de l'appareil", () => {
  it("distingue vide, lié au compte, lié à un autre compte, et sans propriétaire", () => {
    expect(deviceOwnership(undefined, 0, "A")).toBe("empty");
    expect(deviceOwnership({ userId: "A" }, 3, "A")).toBe("ok");
    expect(deviceOwnership({ userId: "B" }, 3, "A")).toBe("foreign");
    expect(deviceOwnership(undefined, 3, "A")).toBe("unowned");
    expect(deviceOwnership({}, 1, "A")).toBe("unowned");
  });
});
