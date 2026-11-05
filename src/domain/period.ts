/**
 * Périodes (SPEC §5.5) : jour, semaine, mois comptable, année, personnalisée.
 * Une période est un intervalle [from, to[ : `to` est exclu.
 */

export type PeriodKind = "day" | "week" | "month" | "year" | "custom";

export interface Period {
  from: Date;
  to: Date;
}

export interface PeriodSettings {
  /** Jour de début du mois comptable, 1 à 31 ; au-delà du dernier jour du mois, c'est le dernier jour (SPEC §4). */
  monthStartDay: number;
  /** Premier jour de la semaine : 0 = dimanche … 6 = samedi. */
  weekStartDay: number;
  /**
   * Si le jour de paie tombe un week-end, le cycle commence le vendredi d'avant.
   * Sans effet quand le jour de début est le 1er (le mois civil reste inchangé).
   */
  payOnFriday?: boolean;
}

const DEFAULT_SETTINGS: PeriodSettings = { monthStartDay: 1, weekStartDay: 1 };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Début du mois comptable (year, month) : le jour demandé, ramené au dernier jour du mois si nécessaire. */
function monthStart(year: number, month: number, startDay: number): Date {
  // Les mois débordants (ex. mois = 12) sont normalisés par le constructeur de Date.
  const normalised = new Date(year, month, 1);
  const y = normalised.getFullYear();
  const m = normalised.getMonth();
  return new Date(y, m, Math.min(startDay, daysInMonth(y, m)));
}

/**
 * Jour réel de début du cycle du mois `month` (nominal). Avec le vendredi activé, un samedi ou un
 * dimanche avance au vendredi précédent. Le 1er n'est jamais avancé (mois civil).
 */
function payDate(year: number, month: number, startDay: number, payOnFriday: boolean): Date {
  const day = monthStart(year, month, startDay);
  if (!payOnFriday || startDay === 1) return day;
  const weekday = day.getDay();
  if (weekday === 6) return new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
  if (weekday === 0) return new Date(day.getFullYear(), day.getMonth(), day.getDate() - 2);
  return day;
}

/** Mois comptable qui contient `anchor`. Ex. startDay = 28 : le 27 janvier appartient à « 28 déc. – 27 janv. ». */
export function accountingMonth(
  anchor: Date,
  monthStartDay = DEFAULT_SETTINGS.monthStartDay,
  payOnFriday = false,
): Period {
  const startDay = Math.min(31, Math.max(1, monthStartDay));
  // Mois nominal du cycle : le début réel peut tomber la veille ou l'avant-veille (vendredi), donc
  // dans le mois d'avant. On avance ou on recule jusqu'à trouver le cycle qui contient `anchor`.
  const start = (base: Date) => payDate(base.getFullYear(), base.getMonth(), startDay, payOnFriday);
  const nominal = (delta: number, base: Date) => new Date(base.getFullYear(), base.getMonth() + delta, 1);
  let base = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  while (start(base) > anchor) base = nominal(-1, base);
  while (start(nominal(1, base)) <= anchor) base = nominal(1, base);
  return { from: start(base), to: start(nominal(1, base)) };
}

export function weekOf(anchor: Date, weekStartDay = DEFAULT_SETTINGS.weekStartDay): Period {
  const dayStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const offset = (dayStart.getDay() - weekStartDay + 7) % 7;
  const from = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() - offset);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  return { from, to };
}

export function dayOf(anchor: Date): Period {
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return { from, to };
}

export function yearOf(anchor: Date): Period {
  return {
    from: new Date(anchor.getFullYear(), 0, 1),
    to: new Date(anchor.getFullYear() + 1, 0, 1),
  };
}

/** Période de même nature, juste avant `period` (pour les comparaisons). */
export function previousPeriod(
  period: Period,
  kind: PeriodKind,
  settings: PeriodSettings = DEFAULT_SETTINGS,
): Period {
  if (kind === "custom") {
    const length = period.to.getTime() - period.from.getTime();
    return { from: new Date(period.from.getTime() - length), to: new Date(period.from.getTime()) };
  }
  const anchor = new Date(period.from.getTime() - 1);
  return periodFor(kind, anchor, settings);
}

/** Période du type demandé qui contient `anchor`. */
export function periodFor(
  kind: Exclude<PeriodKind, "custom">,
  anchor: Date,
  settings: PeriodSettings = DEFAULT_SETTINGS,
): Period {
  switch (kind) {
    case "day":
      return dayOf(anchor);
    case "week":
      return weekOf(anchor, settings.weekStartDay);
    case "month":
      return accountingMonth(anchor, settings.monthStartDay, settings.payOnFriday);
    case "year":
      return yearOf(anchor);
  }
}

/** Clé de jour locale « yyyy-MM-dd » d'une date ISO (fuseau de l'appareil). */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function contains(period: Period, iso: string): boolean {
  const time = new Date(iso).getTime();
  return time >= period.from.getTime() && time < period.to.getTime();
}

/**
 * Découpe une période en sous-périodes entières : semaines ou mois comptables.
 * La première commence au début de la période (ou de la semaine / du mois qui la contient).
 */
export function splitPeriods(
  period: Period,
  step: "week" | "month",
  settings: PeriodSettings = DEFAULT_SETTINGS,
): Period[] {
  const result: Period[] = [];
  const month = (anchor: Date) =>
    accountingMonth(anchor, settings.monthStartDay, settings.payOnFriday);
  let cursor = step === "week" ? weekOf(period.from, settings.weekStartDay) : month(period.from);
  while (cursor.from.getTime() < period.to.getTime()) {
    result.push(cursor);
    const anchor = new Date(cursor.to.getTime());
    cursor = step === "week" ? weekOf(anchor, settings.weekStartDay) : month(anchor);
  }
  return result;
}
