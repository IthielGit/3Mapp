import { describe, expect, it } from "vitest";
import type { Reconciliation, Transaction, Wallet } from "../../src/db/entities";
import { lastKnownActivity, staleWallets, STALE_DAYS } from "../../src/domain/reconciliation";
import { totals } from "../../src/domain/totals";

const W1 = "00000000-0000-4000-8000-000000000001";
const W2 = "00000000-0000-4000-8000-000000000002";
const NOW = new Date(2026, 5, 30, 12);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function wallet(id: string, createdDaysAgo: number, archived = false): Wallet {
  return { id, name: id, createdAt: daysAgo(createdDaysAgo), archived } as Wallet;
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    walletId: W1,
    toWalletId: undefined,
    date: daysAgo(0),
    status: "posted",
    ...partial,
  } as Transaction;
}

describe("dernière activité connue (SPEC §5.12)", () => {
  it("prend le plus récent entre création, mouvements et réconciliations", () => {
    const w = wallet(W1, 100);
    const last = lastKnownActivity(
      w,
      [tx({ date: daysAgo(40) }), tx({ walletId: W2, date: daysAgo(5) })],
      [{ walletId: W1, date: daysAgo(10) } as Reconciliation],
    );
    expect(last).toEqual(new Date(daysAgo(10)));
  });

  it("un virement entrant compte comme activité du portefeuille de destination", () => {
    const w = wallet(W2, 100);
    const last = lastKnownActivity(w, [tx({ walletId: W1, toWalletId: W2, date: daysAgo(3) })], []);
    expect(last).toEqual(new Date(daysAgo(3)));
  });
});

describe("portefeuilles sans saisie (accueil)", () => {
  it(`signale un portefeuille sans activité depuis plus de ${STALE_DAYS} jours`, () => {
    const result = staleWallets([wallet(W1, 200)], [tx({ date: daysAgo(45) })], [], NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.daysSince).toBe(45);
  });

  it("ne signale pas un portefeuille actif récemment", () => {
    expect(staleWallets([wallet(W1, 200)], [tx({ date: daysAgo(3) })], [], NOW)).toEqual([]);
  });

  it("ne signale pas un portefeuille archivé", () => {
    expect(staleWallets([wallet(W1, 200, true)], [], [], NOW)).toEqual([]);
  });

  it("un portefeuille créé récemment et sans mouvement n'est pas signalé", () => {
    expect(staleWallets([wallet(W1, 2)], [], [], NOW)).toEqual([]);
  });

  it("une réconciliation récente met fin à l'alerte", () => {
    const result = staleWallets(
      [wallet(W1, 200)],
      [tx({ date: daysAgo(90) })],
      [{ walletId: W1, date: daysAgo(1) } as Reconciliation],
      NOW,
    );
    expect(result).toEqual([]);
  });
});

describe("écart non détaillé (SPEC §6, règle 3)", () => {
  it("un ajustement non détaillé ne compte ni en revenu ni en dépense, quel que soit son signe", () => {
    const list = [
      tx({ type: "income", amount: 1000 }),
      tx({ type: "adjustment", amount: 5000, undetailed: true }),
      tx({ type: "adjustment", amount: -300, undetailed: true }),
    ];
    expect(totals(list)).toEqual({ income: 1000, expense: 0, net: 1000 });
  });
});
