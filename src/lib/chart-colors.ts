/**
 * Palette des graphiques : même intensité pour toutes les teintes, chacune distincte de ses
 * voisines (les parts consécutives d'un anneau restent lisibles). Le rouge n'apparaît pas :
 * il reste réservé aux dépenses et aux suppressions.
 */
export const CHART_COLORS = [
  "#0f766e", // sarcelle (couleur de marque)
  "#e0a030", // or chaud
  "#7c6ad6", // violet doux
  "#3b9adb", // bleu ciel
  "#d9689b", // rose framboise
  "#7aa845", // vert sauge
  "#e08a4a", // abricot
  "#4c6fd1", // bleu cobalt
  "#2fa58a", // jade
  "#8bc6b0", // menthe
] as const;

/** Couleur de la série à cette position (les premières positions sont les plus distinctes). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "#0f766e";
}
