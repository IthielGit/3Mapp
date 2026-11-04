import type { Transaction, Wallet } from "../db/entities";
import { sumMinor, type Minor } from "../lib/money";

/**
 * Solde d'un portefeuille (SPEC §6, règle 1) :
 * initialBalance + revenus − dépenses ± ajustements + virements entrants − virements sortants − frais.
 * Seules les transactions `posted` comptent. Le solde est toujours calculé, jamais stocké.
 *
 * Virement entrant : reçu dans la devise de la destination (`toAmount`, ou `amount` si même devise).
 * Virement sortant : `amount` dans la devise de la source, plus `fee`.
 */
export function walletBalance(
  wallet: Pick<Wallet, "id" | "initialBalance">,
  transactions: readonly Transaction[],
  asOf?: Date,
): Minor {
  const parts: Minor[] = [wallet.initialBalance];

  for (const t of transactions) {
    if (t.status !== "posted") continue;
    // « Ignorer le solde futur » : seules les transactions jusqu'à `asOf` comptent.
    if (asOf && new Date(t.date).getTime() > asOf.getTime()) continue;

    if (t.type === "income" && t.walletId === wallet.id) {
      parts.push(t.amount);
    } else if (t.type === "expense" && t.walletId === wallet.id) {
      parts.push(-t.amount);
    } else if (t.type === "adjustment" && t.walletId === wallet.id) {
      parts.push(t.amount);
    } else if (t.type === "transfer") {
      if (t.walletId === wallet.id) {
        parts.push(-t.amount);
        if (t.fee) parts.push(-t.fee);
      }
      if (t.toWalletId === wallet.id) {
        parts.push(t.toAmount ?? t.amount);
      }
    }
  }

  return sumMinor(parts);
}

/** Soldes de tous les portefeuilles, indexés par id. */
export function computeBalances(
  wallets: readonly Pick<Wallet, "id" | "initialBalance">[],
  transactions: readonly Transaction[],
  asOf?: Date,
): Record<string, Minor> {
  const result: Record<string, Minor> = {};
  for (const wallet of wallets) {
    result[wallet.id] = walletBalance(wallet, transactions, asOf);
  }
  return result;
}
