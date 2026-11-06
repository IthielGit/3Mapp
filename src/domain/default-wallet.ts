/**
 * Portefeuille source proposé par le formulaire de transaction.
 * Le portefeuille par défaut n'est retenu que s'il figure parmi les portefeuilles actifs :
 * un réglage qui pointe vers un portefeuille supprimé ou archivé ne doit pas laisser le champ
 * afficher le premier portefeuille alors que la valeur réelle est introuvable.
 */
export function resolveSourceWalletId(input: {
  selected: string;
  defaultWalletId?: string | undefined;
  activeWalletIds: readonly string[];
}): string {
  if (input.selected) return input.selected;
  const usableDefault = input.activeWalletIds.find((id) => id === input.defaultWalletId);
  return usableDefault ?? input.activeWalletIds[0] ?? "";
}
