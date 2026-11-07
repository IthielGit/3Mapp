/**
 * Taille d'un montant selon la place disponible : un montant ne se coupe jamais (Règle du Chiffre Droit).
 * Les seuils portent sur la longueur du texte déjà formaté (signe, séparateurs et symbole compris),
 * estimée pour Outfit semi-gras à chiffres tabulaires (chiffre ≈ 0,56 em) sur un écran de 360 px.
 */

/**
 * Carte « Votre mois » : Amount Hero (36 px) par défaut, puis les marches de DESIGN.md.
 * Largeur utile ≈ 288 px à 360 px d'écran (marges 16 px, carte 20 px).
 *  - ≤ 15 caractères (« −125.000.000 Ar ») : text-4xl, 36 px (Amount Hero)
 *  - ≤ 18 caractères (« −12.500.000.000 Ar ») : text-3xl, 30 px (Amount)
 *  - ≤ 22 caractères : text-2xl, 24 px (Headline)
 *  - au-delà (jusqu'au plus grand entier sûr, 25 caractères) : text-lg, 18 px (Title)
 */
export const HERO_AMOUNT_STEPS = [
  { maxLength: 15, className: "text-4xl" },
  { maxLength: 18, className: "text-3xl" },
  { maxLength: 22, className: "text-2xl" },
] as const;

export const HERO_AMOUNT_FALLBACK = "text-lg";

export function heroAmountClass(formatted: string): string {
  const length = [...formatted].length;
  return HERO_AMOUNT_STEPS.find((s) => length <= s.maxLength)?.className ?? HERO_AMOUNT_FALLBACK;
}

/**
 * Carte de portefeuille (deux colonnes, ≈ 134 px utiles à 360 px d'écran, texte de 16 px) :
 * au-delà de 15 caractères, le solde passe au format compact (« 1,25 Md Ar »).
 */
export const WALLET_AMOUNT_MAX_LENGTH = 15;

export function fitsWalletCard(formatted: string): boolean {
  return [...formatted].length <= WALLET_AMOUNT_MAX_LENGTH;
}
