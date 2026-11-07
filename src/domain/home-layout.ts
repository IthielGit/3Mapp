/**
 * Règles de composition de l'accueil : combien d'éléments montrer, quelles sections masquer,
 * vers quel portefeuille envoyer l'action « Réconcilier ».
 */

/** Nombre de portefeuilles affichés sur l'accueil avant le lien « Voir les N portefeuilles ». */
export const HOME_WALLET_LIMIT = 4;

/** Les `max` premiers éléments et le nombre de ceux qui restent cachés. */
export function capList<T>(items: readonly T[], max: number): { shown: T[]; hiddenCount: number } {
  const limit = Math.max(0, Math.floor(max));
  return { shown: items.slice(0, limit), hiddenCount: Math.max(0, items.length - limit) };
}

/** Un virement demande au moins deux portefeuilles actifs. */
export function canTransfer(activeWalletCount: number): boolean {
  return activeWalletCount >= 2;
}

/**
 * Cible de « Réconcilier » :
 * - le portefeuille le plus en retard s'il y en a un (la liste `stale` est triée du plus ancien au plus récent) ;
 * - sinon l'unique portefeuille actif ;
 * - sinon la liste des portefeuilles, pour choisir ;
 * - rien sans portefeuille actif.
 */
export type ReconcileTarget = { kind: "wallet"; walletId: string } | { kind: "list" } | null;

export function reconcileTarget(
  active: readonly { id: string }[],
  stale: readonly { wallet: { id: string } }[],
): ReconcileTarget {
  const stalest = stale[0];
  if (stalest) return { kind: "wallet", walletId: stalest.wallet.id };
  if (active.length === 0) return null;
  const only = active.length === 1 ? active[0] : undefined;
  if (only) return { kind: "wallet", walletId: only.id };
  return { kind: "list" };
}

/**
 * Au premier lancement (ni budget ni transaction), la section Budgets se tait :
 * elle ne doit pas concurrencer la prise en main.
 */
export function showBudgetsSection(budgetCount: number, transactionCount: number): boolean {
  return budgetCount > 0 || transactionCount > 0;
}

/** Sans aucune transaction, l'état vide des dernières transactions n'apporte rien : la section se tait. */
export function showRecentSection(recentCount: number, transactionCount: number): boolean {
  return recentCount > 0 || transactionCount > 0;
}
