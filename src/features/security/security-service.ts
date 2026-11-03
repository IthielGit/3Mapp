import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import { hashPin, isValidPin, randomSalt, verifyPin } from "../../lib/pin";
import { lockedUntilAfterFailure, secondsRemaining } from "../../domain/lockout";

async function settingsId(database: AppDatabase): Promise<string> {
  const first = await database.settings.toCollection().first();
  if (!first) throw new RuleError("Réglages introuvables : terminez l’onboarding");
  return first.id;
}

export async function hasPin(database: AppDatabase = defaultDb): Promise<boolean> {
  const s = await database.settings.toCollection().first();
  return Boolean(s?.pinHash && s.pinSalt);
}

/** Crée ou remplace le PIN. Si un PIN existe, `currentPin` doit être fourni et correct. */
export async function setPin(
  newPin: string,
  currentPin: string | undefined,
  database: AppDatabase = defaultDb,
): Promise<void> {
  if (!isValidPin(newPin)) throw new RuleError("Le PIN doit comporter 4 à 6 chiffres");
  const s = await database.settings.toCollection().first();
  if (s?.pinHash && s.pinSalt) {
    if (!currentPin || !(await verifyPin(currentPin, s.pinSalt, s.pinHash))) {
      throw new RuleError("PIN actuel incorrect");
    }
  }
  const salt = randomSalt();
  const hash = await hashPin(newPin, salt);
  await database.settings.update(await settingsId(database), {
    pinHash: hash,
    pinSalt: salt,
    pinFailures: 0,
    pinLockedUntil: undefined,
  });
}

export async function removePin(
  currentPin: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  const s = await database.settings.toCollection().first();
  if (!s?.pinHash || !s.pinSalt) return;
  if (!(await verifyPin(currentPin, s.pinSalt, s.pinHash))) throw new RuleError("PIN incorrect");
  await database.settings.update(s.id, {
    pinHash: undefined,
    pinSalt: undefined,
    pinFailures: 0,
    pinLockedUntil: undefined,
  });
}

export type PinResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; retryInSeconds: number }
  | { ok: false; reason: "locked"; retryInSeconds: number };

/**
 * Vérifie un PIN en tenant compte de la temporisation (SPEC §5.15).
 * Un succès remet le compteur à zéro ; un échec l'incrémente et peut verrouiller pour un délai croissant.
 */
export async function attemptPin(
  pin: string,
  now = new Date(),
  database: AppDatabase = defaultDb,
): Promise<PinResult> {
  const s = await database.settings.toCollection().first();
  if (!s?.pinHash || !s.pinSalt) return { ok: true };

  const wait = secondsRemaining(s.pinLockedUntil, now);
  if (wait > 0) return { ok: false, reason: "locked", retryInSeconds: wait };

  if (await verifyPin(pin, s.pinSalt, s.pinHash)) {
    await database.settings.update(s.id, { pinFailures: 0, pinLockedUntil: undefined });
    return { ok: true };
  }

  const failures = (s.pinFailures ?? 0) + 1;
  const until = lockedUntilAfterFailure(failures, now);
  await database.settings.update(s.id, {
    pinFailures: failures,
    pinLockedUntil: until?.toISOString(),
  });
  return until
    ? { ok: false, reason: "locked", retryInSeconds: secondsRemaining(until.toISOString(), now) }
    : { ok: false, reason: "wrong", retryInSeconds: 0 };
}

export async function setAutoLock(
  seconds: number,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.settings.update(await settingsId(database), { autoLockSeconds: seconds });
}

export async function setHideAmounts(
  hide: boolean,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.settings.update(await settingsId(database), { hideAmounts: hide });
}

export async function setBiometric(
  credentialId: string | undefined,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.settings.update(await settingsId(database), {
    biometricCredentialId: credentialId,
  });
}
