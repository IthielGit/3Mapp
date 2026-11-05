/**
 * Récurrences (SPEC §5.7). Chaque occurrence se calcule directement depuis la date de départ et son index,
 * donc un mois court ne décale jamais les mois suivants.
 */

export type RecurrenceUnit = "day" | "week" | "month" | "year";
export type DayRule = "same_day" | "last_day";

export interface Frequency {
  unit: RecurrenceUnit;
  interval: number;
}

function daysIn(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Date de l'occurrence n° `index` (0 = date de départ). Heure conservée depuis la date de départ. */
export function occurrenceDate(
  start: Date,
  frequency: Frequency,
  index: number,
  rule: DayRule,
): Date {
  const h = start.getHours();
  const mi = start.getMinutes();
  const steps = index * frequency.interval;

  switch (frequency.unit) {
    case "day":
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + steps, h, mi);
    case "week":
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + steps * 7, h, mi);
    case "month": {
      const total = start.getMonth() + steps;
      const year = start.getFullYear() + Math.floor(total / 12);
      const month = ((total % 12) + 12) % 12;
      const day =
        rule === "last_day" ? daysIn(year, month) : Math.min(start.getDate(), daysIn(year, month));
      return new Date(year, month, day, h, mi);
    }
    case "year": {
      const year = start.getFullYear() + steps;
      const month = start.getMonth();
      const day =
        rule === "last_day" ? daysIn(year, month) : Math.min(start.getDate(), daysIn(year, month));
      return new Date(year, month, day, h, mi);
    }
  }
}

export interface RecurrenceSpec {
  startDate: string;
  endDate?: string | undefined;
  frequency: Frequency;
  dayOfMonthRule: DayRule;
  occurrenceIndex: number;
}

/**
 * Dates des occurrences échues et non encore générées : depuis `occurrenceIndex` jusqu'à `now`
 * (incluse), sans dépasser la date de fin. Fonction pure : ne modifie rien.
 */
export function dueOccurrences(spec: RecurrenceSpec, now: Date, limit = 5000): Date[] {
  const start = new Date(spec.startDate);
  const end = spec.endDate ? new Date(spec.endDate) : undefined;
  const due: Date[] = [];
  for (let index = spec.occurrenceIndex; due.length < limit; index++) {
    const date = occurrenceDate(start, spec.frequency, index, spec.dayOfMonthRule);
    if (date.getTime() > now.getTime()) break;
    if (end && date.getTime() > end.getTime()) break;
    due.push(date);
  }
  return due;
}

/**
 * Occurrences pas encore générées (à partir de `occurrenceIndex`) et antérieures à `until` (exclue).
 * Sert au reste à vivre : une récurrence hebdomadaire peut compter plusieurs fois avant la paie.
 */
export function upcomingOccurrences(spec: RecurrenceSpec, until: Date, limit = 500): Date[] {
  const start = new Date(spec.startDate);
  const end = spec.endDate ? new Date(spec.endDate) : undefined;
  const dates: Date[] = [];
  for (let index = spec.occurrenceIndex; dates.length < limit; index++) {
    const date = occurrenceDate(start, spec.frequency, index, spec.dayOfMonthRule);
    if (date.getTime() >= until.getTime()) break;
    if (end && date.getTime() > end.getTime()) break;
    dates.push(date);
  }
  return dates;
}

/** Index de la première occurrence postérieure à `now` : utilisé à la reprise d'une récurrence en pause. */
export function indexAfter(spec: Omit<RecurrenceSpec, "occurrenceIndex">, now: Date): number {
  const start = new Date(spec.startDate);
  let index = 0;
  while (
    occurrenceDate(start, spec.frequency, index, spec.dayOfMonthRule).getTime() <= now.getTime()
  ) {
    index++;
    if (index > 100000) break;
  }
  return index;
}
