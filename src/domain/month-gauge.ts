/**
 * Jauge du mois : reprend le logo (arc de 270°, point au bout = ce qui reste).
 * Ici, la part de ce qui a été reçu et qui reste en fin de mois. Pure, sans rendu.
 */

/** Part restante du revenu du mois, entre 0 et 1. Sans revenu : 0 (jauge vide). */
export function remainingShare(income: number, expense: number): number {
  if (income <= 0) return 0;
  const share = (income - expense) / income;
  return Math.min(1, Math.max(0, share));
}

export interface GaugePoint {
  x: number;
  y: number;
}

export interface GaugeGeometry {
  /** Arc complet, en fond (270°). */
  track: string;
  /** Arc rempli jusqu'à la part restante ; null quand la part est nulle. */
  fill: string | null;
  /** Point au bout de l'arc rempli ; null quand la part est nulle. */
  dot: GaugePoint | null;
}

const CENTER = 24;
const RADIUS = 20;
/** Départ en bas à gauche (135°), balayage de 270° dans le sens horaire (repère SVG). */
const START_DEG = 135;
const SWEEP_DEG = 270;

function pointAt(angleDeg: number): GaugePoint {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Number((CENTER + RADIUS * Math.cos(rad)).toFixed(2)),
    y: Number((CENTER + RADIUS * Math.sin(rad)).toFixed(2)),
  };
}

function arcPath(sweepDeg: number): string {
  const from = pointAt(START_DEG);
  const to = pointAt(START_DEG + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${to.x} ${to.y}`;
}

/** Géométrie SVG (viewBox 48×48) de la jauge pour une part entre 0 et 1. */
export function gaugeGeometry(fraction: number): GaugeGeometry {
  const f = Math.min(1, Math.max(0, fraction));
  if (f === 0) return { track: arcPath(SWEEP_DEG), fill: null, dot: null };
  const sweep = SWEEP_DEG * f;
  return {
    track: arcPath(SWEEP_DEG),
    fill: arcPath(sweep),
    dot: pointAt(START_DEG + sweep),
  };
}
