export interface DefaultCategory {
  name: string;
  kind: "expense" | "income";
  icon: string;
  color: string;
}

/** Jeu de catégories par défaut (SPEC §5.3). Les noms sont des libellés de départ, modifiables. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Alimentation", kind: "expense", icon: "🍽️", color: "#d97706" },
  { name: "Logement", kind: "expense", icon: "🏠", color: "#2563eb" },
  { name: "Transport", kind: "expense", icon: "🚗", color: "#475569" },
  { name: "Santé", kind: "expense", icon: "💊", color: "#dc2626" },
  { name: "Éducation", kind: "expense", icon: "🎓", color: "#7c3aed" },
  { name: "Loisirs", kind: "expense", icon: "🎮", color: "#db2777" },
  { name: "Vêtements", kind: "expense", icon: "👕", color: "#0891b2" },
  { name: "Famille / entraide", kind: "expense", icon: "👨‍👩‍👧", color: "#059669" },
  { name: "Investissements", kind: "expense", icon: "📈", color: "#0B7E9D" },
  { name: "Téléphone et internet", kind: "expense", icon: "📱", color: "#0284c7" },
  { name: "Électricité et eau", kind: "expense", icon: "💡", color: "#ca8a04" },
  { name: "Assurances", kind: "expense", icon: "🛡️", color: "#4f46e5" },
  { name: "Frais bancaires", kind: "expense", icon: "🏦", color: "#78716c" },
  { name: "Abonnements", kind: "expense", icon: "🔁", color: "#9333ea" },
  { name: "Impôts et taxes", kind: "expense", icon: "🧾", color: "#b45309" },
  { name: "Dons et solidarité", kind: "expense", icon: "🤝", color: "#15803d" },
  { name: "Remboursements", kind: "expense", icon: "🔄", color: "#9f1239" },
  { name: "Divers", kind: "expense", icon: "📦", color: "#64748b" },
  { name: "Salaire", kind: "income", icon: "💼", color: "#059669" },
  { name: "Primes", kind: "income", icon: "🏅", color: "#16a34a" },
  { name: "Activité annexe", kind: "income", icon: "🧑‍💻", color: "#0369a1" },
  { name: "Intérêts", kind: "income", icon: "🏧", color: "#0d9488" },
  { name: "Remboursements", kind: "income", icon: "🔄", color: "#0891b2" },
  { name: "Ventes", kind: "income", icon: "🛒", color: "#d97706" },
  { name: "Cadeaux", kind: "income", icon: "🎁", color: "#db2777" },
  { name: "Autres revenus", kind: "income", icon: "💰", color: "#64748b" },
];

/** Clé de comparaison : même nature et même nom, sans tenir compte de la casse ni des espaces. */
function defaultKey(kind: DefaultCategory["kind"], name: string): string {
  return `${kind}|${name.trim().toLocaleLowerCase("fr")}`;
}

/**
 * Catégories par défaut absentes de la liste donnée. Une catégorie archivée compte comme présente :
 * on ne recrée pas un doublon, l'utilisateur la restaure depuis la liste des archives.
 */
export function missingDefaultCategories(
  existing: readonly { name: string; kind: DefaultCategory["kind"]; origin?: string }[],
): DefaultCategory[] {
  const present = new Set(existing.map((c) => defaultKey(c.kind, c.name)));
  const origins = new Set(existing.map((c) => c.origin).filter((o): o is string => o !== undefined));
  // Présente si une catégorie porte son nom d'origine, ou son origine, même renommée.
  return DEFAULT_CATEGORIES.filter((d) => {
    const key = defaultKey(d.kind, d.name);
    return !present.has(key) && !origins.has(key);
  });
}

/** Origine d'une catégorie créée à partir du jeu par défaut. */
export function defaultOrigin(category: Pick<DefaultCategory, "kind" | "name">): string {
  return defaultKey(category.kind, category.name);
}

/** Vrai si la clé (nature|nom) désigne une catégorie du jeu par défaut. */
export function isDefaultCategoryKey(key: string): boolean {
  return DEFAULT_CATEGORIES.some((d) => defaultKey(d.kind, d.name) === key);
}

function hash32(input: string, seed: number): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Identifiant stable (UUID, format v4) d'une catégorie par défaut, dérivé de sa nature et de son nom.
 * Deux appareils qui créent le même jeu produisent les mêmes identifiants : la synchro fusionne au lieu
 * de dupliquer.
 */
export function defaultCategoryId(kind: DefaultCategory["kind"], name: string): string {
  const key = defaultKey(kind, name);
  const hex = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => hash32(key, seed).toString(16).padStart(8, "0"))
    .join("");
  const variant = "89ab"[parseInt(hex[16] ?? "0", 16) & 3];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Catégories existantes sans origine qui correspondent à une catégorie par défaut : on leur donne
 * l'origine (une fois). Une catégorie déjà rattachée n'est pas revendiquée deux fois.
 */
export function originBackfill(
  existing: readonly { id: string; name: string; kind: DefaultCategory["kind"]; origin?: string }[],
): { id: string; origin: string }[] {
  const claimed = new Set(existing.map((c) => c.origin).filter((o): o is string => o !== undefined));
  const updates: { id: string; origin: string }[] = [];
  for (const category of existing) {
    if (category.origin !== undefined) continue;
    const key = defaultKey(category.kind, category.name);
    const isDefault = DEFAULT_CATEGORIES.some((d) => defaultKey(d.kind, d.name) === key);
    if (!isDefault || claimed.has(key)) continue;
    updates.push({ id: category.id, origin: key });
    claimed.add(key);
  }
  return updates;
}

/**
 * Catégories par défaut à (re)créer : absentes (ni leur nom ni leur origine ne sont présents) et non masquées
 * par l'utilisateur. Le jeu se répare ainsi tout seul : une catégorie perdue sans action de l'utilisateur
 * (synchro, ancienne version de l'app) revient ; une catégorie supprimée par l'utilisateur, non.
 * Une nouvelle catégorie ajoutée au jeu est proposée à tous les comptes par la même règle.
 */
export function defaultsToEnsure(
  existing: readonly { name: string; kind: DefaultCategory["kind"]; origin?: string }[],
  hidden: readonly string[] = [],
): DefaultCategory[] {
  const hiddenKeys = new Set(hidden);
  return missingDefaultCategories(existing).filter((d) => !hiddenKeys.has(defaultKey(d.kind, d.name)));
}

/**
 * Clé de catégorie par défaut que l'utilisateur fait disparaître en supprimant (ou fusionnant) cette catégorie :
 * son origine, sinon son nom s'il est celui d'une catégorie par défaut. `undefined` pour une catégorie personnelle.
 */
export function defaultKeyOf(category: { name: string; kind: DefaultCategory["kind"]; origin?: string }): string | undefined {
  const key = category.origin ?? defaultKey(category.kind, category.name);
  return isDefaultCategoryKey(key) ? key : undefined;
}

interface CanonicalRow {
  id: string;
  name: string;
  kind: DefaultCategory["kind"];
  archived?: boolean;
  createdAt: string;
}

/** Fusion à faire pour une catégorie par défaut : ses copies à identifiant aléatoire vers la ligne stable. */
export interface CanonicalMerge<T extends CanonicalRow> {
  key: string;
  stableId: string;
  /** Copies à fusionner, la plus « représentative » en tête (active, puis la plus ancienne). */
  copies: T[];
  /** Vrai si la ligne stable n'existe pas : elle est créée à partir de la première copie. */
  createStable: boolean;
}

/**
 * Plan de fusion des doublons de catégories par défaut. Toutes les copies portant le nom d'une catégorie par
 * défaut vont vers sa ligne à identifiant stable, créée au besoin. La ligne stable n'est jamais supprimée :
 * chaque appareil converge vers le même identifiant, quelles que soient les lignes qu'il voit.
 * Une ligne stable renommée par l'utilisateur n'accueille pas les copies (ce n'est plus la même catégorie).
 */
export function canonicalMerges<T extends CanonicalRow>(existing: readonly T[]): CanonicalMerge<T>[] {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const merges: CanonicalMerge<T>[] = [];
  for (const d of DEFAULT_CATEGORIES) {
    const key = defaultKey(d.kind, d.name);
    const stableId = defaultCategoryId(d.kind, d.name);
    const copies = existing
      .filter((c) => c.id !== stableId && defaultKey(c.kind, c.name) === key)
      .sort(
        (a, b) =>
          Number(a.archived ?? false) - Number(b.archived ?? false) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
    if (copies.length === 0) continue;
    const stable = byId.get(stableId);
    if (stable && defaultKey(stable.kind, stable.name) !== key) continue;
    merges.push({ key, stableId, copies, createStable: stable === undefined });
  }
  return merges;
}
