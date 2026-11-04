/** Rappel quotidien de saisie : logique pure (sans accès au navigateur ni à la base). */

/** Jour local au format AAAA-MM-JJ. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ReminderState {
  enabled: boolean;
  /** Heure du rappel au format HH:mm, heure locale. */
  time: string | undefined;
  /** Jour du dernier rappel affiché (AAAA-MM-JJ). */
  lastDay: string | undefined;
}

/**
 * Le rappel est dû si : il est activé, l'heure est atteinte aujourd'hui, et il n'a pas encore
 * été affiché aujourd'hui. Une seule notification par jour.
 */
export function reminderDue(state: ReminderState, now: Date): boolean {
  if (!state.enabled || !state.time) return false;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(state.time);
  if (!match) return false;
  const due = new Date(now);
  due.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (now.getTime() < due.getTime()) return false;
  return state.lastDay !== localDayKey(now);
}
