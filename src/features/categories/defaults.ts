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
  { name: "Investissements", kind: "expense", icon: "📈", color: "#0f766e" },
  { name: "Divers", kind: "expense", icon: "📦", color: "#64748b" },
  { name: "Salaire", kind: "income", icon: "💼", color: "#059669" },
  { name: "Remboursements", kind: "income", icon: "🔄", color: "#0891b2" },
  { name: "Ventes", kind: "income", icon: "🛒", color: "#d97706" },
  { name: "Cadeaux", kind: "income", icon: "🎁", color: "#db2777" },
  { name: "Autres revenus", kind: "income", icon: "💰", color: "#64748b" },
];
