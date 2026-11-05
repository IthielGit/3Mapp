/**
 * Couleurs vives et distinctes pour les graphiques. Le rouge reste réservé aux dépenses
 * (et aux suppressions dans l'interface) : il n'apparaît pas dans cette liste.
 */
export const CHART_COLORS = [
  "#0d9488", // sarcelle
  "#f59e0b", // ambre
  "#8b5cf6", // violet
  "#0ea5e9", // ciel
  "#ec4899", // rose
  "#84cc16", // citron vert
  "#f97316", // orange
  "#6366f1", // indigo
  "#10b981", // émeraude
  "#eab308", // jaune
] as const;

/** Couleur de la série à cette position (les premières positions sont les plus distinctes). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "#0d9488";
}
