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
  existing: readonly { name: string; kind: DefaultCategory["kind"] }[],
): DefaultCategory[] {
  const present = new Set(existing.map((c) => defaultKey(c.kind, c.name)));
  return DEFAULT_CATEGORIES.filter((d) => !present.has(defaultKey(d.kind, d.name)));
}
