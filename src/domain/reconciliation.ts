import type { Reconciliation, Transaction, Wallet } from "../db/entities";

/** Au-delà de ce nombre de jours sans saisie ni réconciliation, l'accueil propose de réconcilier. */
export const STALE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dernière activité connue d'un portefeuille : création, dernier mouvement (entrant ou sortant)
 * ou dernière réconciliation. Sert de début de la période non détaillée d'un écart.
 */
export function lastKnownActivity(
  wallet: Pick<Wallet, "id" | "createdAt">,
  transactions: readonly Pick<Transaction, "walletId" | "toWalletId" | "date">[],
  reconciliations: readonly Pick<Reconciliation, "walletId" | "date">[],
): Date {
  let latest = new Date(wallet.createdAt).getTime();
  for (const t of transactions) {
    if (t.walletId !== wallet.id && t.toWalletId !== wallet.id) continue;
    latest = Math.max(latest, new Date(t.date).getTime());
  }
  for (const r of reconciliations) {
    if (r.walletId !== wallet.id) continue;
    latest = Math.max(latest, new Date(r.date).getTime());
  }
  return new Date(latest);
}

export interface StaleWallet {
  wallet: Wallet;
  lastActivity: Date;
  daysSince: number;
}

/**
 * Portefeuilles actifs sans activité connue depuis plus de `days` jours, du plus ancien au plus récent.
 * Un portefeuille archivé n'est pas concerné.
 */
export function staleWallets(
  wallets: readonly Wallet[],
  transactions: readonly Pick<Transaction, "walletId" | "toWalletId" | "date">[],
  reconciliations: readonly Pick<Reconciliation, "walletId" | "date">[],
  now: Date,
  days = STALE_DAYS,
): StaleWallet[] {
  const result: StaleWallet[] = [];
  for (const wallet of wallets) {
    if (wallet.archived) continue;
    const lastActivity = lastKnownActivity(wallet, transactions, reconciliations);
    const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS);
    if (daysSince > days) result.push({ wallet, lastActivity, daysSince });
  }
  return result.sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());
}
