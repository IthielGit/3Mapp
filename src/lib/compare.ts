/** Tri alphabétique français (A → Z), insensible à la casse et aux accents. */
export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
}
