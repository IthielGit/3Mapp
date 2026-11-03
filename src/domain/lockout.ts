/**
 * Temporisation après échecs de PIN (SPEC §5.15) : trois essais gratuits, puis un délai croissant, plafonné.
 */
export const FREE_ATTEMPTS = 3;
export const MAX_DELAY_SECONDS = 15 * 60;

/** Délai d'attente en secondes après `failures` échecs consécutifs. */
export function lockoutDelaySeconds(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  const exponent = failures - FREE_ATTEMPTS;
  return Math.min(MAX_DELAY_SECONDS, 30 * 2 ** exponent);
}

/** Instant jusqu'auquel le PIN est refusé, ou null si l'essai est permis. */
export function lockedUntilAfterFailure(failures: number, now: Date): Date | null {
  const delay = lockoutDelaySeconds(failures);
  return delay > 0 ? new Date(now.getTime() + delay * 1000) : null;
}

/** Secondes restantes avant le prochain essai autorisé. */
export function secondsRemaining(lockedUntil: string | undefined, now: Date): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - now.getTime()) / 1000));
}
