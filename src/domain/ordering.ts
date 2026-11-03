/** Échange un élément avec son voisin (direction -1 = monter, +1 = descendre). Ne modifie pas l'entrée. */
export function moveItem<T extends { id: string }>(
  items: readonly T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const next = [...items];
  const from = next.findIndex((item) => item.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= next.length) return next;
  const a = next[from];
  const b = next[to];
  if (a === undefined || b === undefined) return next;
  next[from] = b;
  next[to] = a;
  return next;
}

/** Pour une liste ordonnée, retourne les éléments dont sortOrder doit être corrigé. */
export function sortOrderChanges<T extends { id: string; sortOrder: number }>(
  ordered: readonly T[],
): { id: string; sortOrder: number }[] {
  return ordered.flatMap((item, index) =>
    item.sortOrder === index ? [] : [{ id: item.id, sortOrder: index }],
  );
}
