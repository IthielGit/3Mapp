import { db as defaultDb, type AppDatabase } from "../../db/database";
import type { Transaction } from "../../db/entities";

/** Générateur déterministe (mulberry32) : mêmes données démo à chaque génération. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEMOS = [
  "Marché",
  "Riz et huile",
  "Taxi",
  "Essence",
  "Pharmacie",
  "Facture électricité",
  "Restaurant",
  "Cours",
  "Cinéma",
  "Vêtements enfants",
  "Salaire mensuel",
  "Vente en ligne",
  "Remboursement",
  "Épargne",
];

/**
 * Ajoute `count` transactions de démo sur les 365 derniers jours, dans les portefeuilles
 * de même devise que le premier portefeuille actif. Nécessite au moins un portefeuille et des catégories.
 */
export async function generateDemoTransactions(
  count: number,
  database: AppDatabase = defaultDb,
  seed = 42,
): Promise<number> {
  const wallets = (await database.wallets.toArray()).filter((w) => !w.archived);
  const first = wallets[0];
  if (!first) throw new Error("Créez au moins un portefeuille avant de générer des données");
  const usable = wallets.filter((w) => w.currency === first.currency);
  const categories = (await database.categories.toArray()).filter((c) => !c.archived);
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  const next = random(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const now = Date.now();
  const rows: Transaction[] = [];

  for (let i = 0; i < count; i++) {
    const roll = next();
    const wallet = pick(usable);
    const date = new Date(now - Math.floor(next() * 365 * 24 * 3600 * 1000)).toISOString();
    const base = {
      id: crypto.randomUUID(),
      createdAt: date,
      updatedAt: date,
      currency: wallet.currency,
      walletId: wallet.id,
      memo: pick(MEMOS),
      attachmentIds: [] as string[],
      date,
      status: "posted" as const,
    };

    if (roll < 0.7 && expenseCats.length > 0) {
      const amount = Math.round((500 + next() * 150000) / 100) * 100;
      rows.push({ ...base, type: "expense", amount, categoryId: pick(expenseCats).id });
    } else if (roll < 0.8 && incomeCats.length > 0) {
      const amount = Math.round((50000 + next() * 900000) / 1000) * 1000;
      rows.push({ ...base, type: "income", amount, categoryId: pick(incomeCats).id });
    } else if (roll < 0.95 && usable.length > 1) {
      const target = pick(usable.filter((w) => w.id !== wallet.id));
      const amount = Math.round((5000 + next() * 200000) / 100) * 100;
      rows.push({ ...base, type: "transfer", amount, toWalletId: target.id });
    } else {
      const amount = Math.round((next() * 20000 - 10000) / 100) * 100;
      rows.push({ ...base, type: "adjustment", amount, memo: "Ajustement" });
    }
  }

  const CHUNK = 500;
  await database.transaction("rw", database.transactions, async () => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await database.transactions.bulkAdd(rows.slice(i, i + CHUNK));
    }
  });
  return rows.length;
}
