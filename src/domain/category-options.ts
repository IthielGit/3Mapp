import { byName } from "../lib/compare";

interface ChoosableCategory {
  id: string;
  name: string;
  kind: "expense" | "income";
  archived?: boolean;
}

/**
 * Catégories proposées dans un sélecteur : celles de la nature voulue, non archivées, par ordre alphabétique.
 * `keepId` (catégorie déjà enregistrée sur l'élément modifié) reste proposée même archivée : sinon le champ
 * paraîtrait vide alors que l'élément a bien une catégorie.
 */
export function categoryChoices<T extends ChoosableCategory>(
  categories: readonly T[],
  kind: ChoosableCategory["kind"],
  keepId?: string,
): T[] {
  return categories
    .filter((c) => c.kind === kind && (!c.archived || (keepId !== undefined && c.id === keepId)))
    .sort(byName);
}
