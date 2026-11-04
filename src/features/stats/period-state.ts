import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { periodFor, type Period, type PeriodKind, type PeriodSettings } from "../../domain/period";

/** Réglages de période lus en base (jour de début de mois, premier jour de semaine). */
export function usePeriodSettings(): PeriodSettings {
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const first = settings?.[0];
  return {
    // Le mois suit toujours le calendrier (du 1er au dernier jour) : le réglage « premier jour du mois » est retiré.
    monthStartDay: 1,
    weekStartDay: first?.weekStartDay ?? 1,
  };
}

export interface PeriodState {
  kind: PeriodKind;
  anchor: Date;
  custom?: Period | undefined;
}

export function currentPeriod(state: PeriodState, settings: PeriodSettings): Period {
  if (state.kind === "custom" && state.custom) return state.custom;
  if (state.kind === "custom") return periodFor("month", state.anchor, settings);
  return periodFor(state.kind, state.anchor, settings);
}

/** Décale la période d'un cran (précédente ou suivante) en gardant sa nature. */
export function shiftPeriod(
  state: PeriodState,
  settings: PeriodSettings,
  direction: -1 | 1,
): PeriodState {
  const period = currentPeriod(state, settings);
  if (direction === 1) {
    return { kind: state.kind, anchor: new Date(period.to.getTime()), custom: undefined };
  }
  return { kind: state.kind, anchor: new Date(period.from.getTime() - 1), custom: undefined };
}
