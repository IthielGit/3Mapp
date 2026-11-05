/**
 * Palette des graphiques : chaque teinte atteint au moins 3:1 sur le fond crème (contraste des
 * éléments graphiques) et reste distincte de ses voisines. Le rouge n'y figure pas : il reste
 * réservé aux dépenses et aux suppressions.
 */
export const CHART_COLORS = [
  "#0B7E9D", // sarcelle (couleur de marque)
  "#a86b12", // ocre
  "#7c6ad6", // violet doux
  "#2b7fc4", // bleu
  "#c24f85", // framboise
  "#5a8a2e", // sauge
  "#c4672c", // abricot
  "#4c6fd1", // cobalt
] as const;

/** Couleur de la série à cette position (les premières positions sont les plus distinctes). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "#0B7E9D";
}
