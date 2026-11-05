import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import { exchangeRateSchema, reconciliationSchema, type Reconciliation } from "../../db/entities";
import { walletBalance } from "../../domain/balance";
import { upTo } from "../../domain/cutoff";
import type { CurrencyCode, Minor } from "../../lib/money";
import { createTransaction } from "../transactions/transaction-service";

/* ---------- Taux de change ---------- */

export async function saveRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number,
  date: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  if (from === to) throw new RuleError("Les deux devises doivent être différentes");
  if (!Number.isFinite(rate) || rate <= 0) throw new RuleError("Taux invalide");
  const now = new Date().toISOString();
  const parsed = exchangeRateSchema.safeParse({
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    from,
    to,
    rate,
    date,
  });
  if (!parsed.success) throw new RuleError(parsed.error.issues[0]?.message ?? "Taux invalide");
  await database.exchangeRates.add(parsed.data);
}

export async function deleteRate(id: string, database: AppDatabase = defaultDb): Promise<void> {
  await database.exchangeRates.delete(id);
}

/* ---------- Réconciliation (SPEC §5.12) ---------- */

/**
 * Réconcilie un portefeuille : l'utilisateur donne son solde réel ; si l'écart n'est pas nul,
 * une transaction `adjustment` est créée pour le combler. L'opération est historisée.
 * Après réconciliation, le solde calculé égale le solde réel saisi.
 */
export async function reconcileWallet(
  walletId: string,
  realBalance: Minor,
  memo: string,
  now = new Date(),
  database: AppDatabase = defaultDb,
  cutoff?: Date,
): Promise<Reconciliation> {
  return database.transaction(
    "rw",
    [
      database.wallets,
      database.transactions,
      database.categories,
      database.subcategories,
      database.reconciliations,
    ],
    async () => {
      const wallet = await database.wallets.get(walletId);
      if (!wallet) throw new RuleError("Portefeuille introuvable");
      const transactions = await database.transactions.toArray();
      // Même règle que l'écran : les mouvements à venir ne comptent pas si l'option est activée.
      const computedBalance = walletBalance(wallet, upTo(transactions, cutoff));
      const adjustment = realBalance - computedBalance;

      let transactionId: string | undefined;
      if (adjustment !== 0) {
        const tx = await createTransaction(
          {
            type: "adjustment",
            amount: adjustment,
            walletId,
            memo: memo.trim() || "Réconciliation",
            attachmentIds: [],
            date: now.toISOString(),
            status: "posted",
          },
          database,
        );
        transactionId = tx.id;
      }

      const stamp = now.toISOString();
      const parsed = reconciliationSchema.parse({
        id: crypto.randomUUID(),
        createdAt: stamp,
        updatedAt: stamp,
        walletId,
        date: stamp,
        realBalance,
        computedBalance,
        adjustment,
        transactionId,
        memo: memo.trim(),
      });
      await database.reconciliations.add(parsed);
      return parsed;
    },
  );
}
