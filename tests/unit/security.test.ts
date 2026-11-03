import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, randomSalt, verifyPin } from "../../src/lib/pin";
import {
  lockedUntilAfterFailure,
  lockoutDelaySeconds,
  secondsRemaining,
} from "../../src/domain/lockout";

describe("PIN (SPEC §5.15)", () => {
  it("accepte 4 à 6 chiffres seulement", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("le PIN n’est jamais stocké en clair : l’empreinte ne contient pas le PIN et change avec le sel", async () => {
    const salt = randomSalt();
    const hash = await hashPin("4826", salt);
    expect(hash).not.toContain("4826");
    expect(await hashPin("4826", randomSalt())).not.toBe(hash);
  });

  it("vérifie le bon PIN et refuse le mauvais", async () => {
    const salt = randomSalt();
    const hash = await hashPin("4826", salt);
    expect(await verifyPin("4826", salt, hash)).toBe(true);
    expect(await verifyPin("4827", salt, hash)).toBe(false);
  });
});

describe("temporisation après échecs", () => {
  it("trois essais gratuits, puis délai qui double et est plafonné", () => {
    expect(lockoutDelaySeconds(1)).toBe(0);
    expect(lockoutDelaySeconds(2)).toBe(0);
    expect(lockoutDelaySeconds(3)).toBe(30);
    expect(lockoutDelaySeconds(4)).toBe(60);
    expect(lockoutDelaySeconds(5)).toBe(120);
    expect(lockoutDelaySeconds(50)).toBe(15 * 60);
  });

  it("après un échec verrouillé, le compte à rebours est correct", () => {
    const now = new Date(2026, 0, 1, 12);
    const until = lockedUntilAfterFailure(3, now);
    expect(until).not.toBeNull();
    expect(secondsRemaining(until?.toISOString() ?? "", now)).toBe(30);
    expect(lockedUntilAfterFailure(2, now)).toBeNull();
  });
});
