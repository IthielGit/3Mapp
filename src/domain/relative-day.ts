import { differenceInCalendarDays } from "date-fns";

export type RelativeDay = { kind: "today" } | { kind: "yesterday" } | { kind: "date"; date: Date };

/**
 * Jour d'une date par rapport à « maintenant », dans le fuseau local :
 * aujourd'hui, hier, ou la date elle-même (les dates futures aussi).
 */
export function relativeDay(dateIso: string, now: Date): RelativeDay {
  const date = new Date(dateIso);
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return { kind: "today" };
  if (diff === 1) return { kind: "yesterday" };
  return { kind: "date", date };
}
