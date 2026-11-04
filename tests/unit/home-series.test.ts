import { describe, expect, it } from "vitest";
import type { ExchangeRate, Transaction, Wallet } from "../../src/db/entities";
import { dailyExpenses, dailyTotals } from "../../src/domain/home-series";
import { computeBalances } from "../../src/domain/balance";
import { convertedSum } from "../../src/domain/fx";

const NOW = new Date(2026, 10, 10, 12); // 10 novembre 2026, midi (heure locale)

const wallet = (id: string, currency: "MGA" | "EUR", initial: number): Wallet =>
  ({
    id,
    name: id,
    icon: "x",
    color: "#000",
    currency,
    initialBalance: initial,
    sortOrder: 0,
    includeInTotal: true,
    group: "bank",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }) as Wallet;

const tx = (
  id: string,
  date: Date,
  type: Transaction["type"],
  amount: number,
  walletId = "a",
): Transaction =>
  ({
    id,
    type,
    amount,
    currency: "MGA",
    walletId,
    memo: "",
    attachmentIds: [],
    date: date.toISOString(),
    status: "posted",
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  }) as Transaction;

const days = ["2026-11-08", "2026-11-09", "2026-11-10"];
const wallets = [wallet("a", "MGA", 1000)];
const rates: ExchangeRate[] = [];

describe("mini-graphique du solde", () => {
  it("le dernier point égale le solde affiché", () => {
    const txs = [
      tx("t1", new Date(2026, 10, 9, 10), "income", 500),
      tx("t2", new Date(2026, 10, 10, 9), "expense", 200),
    ];
    const series = dailyTotals(wallets, txs, days, "MGA", rates, undefined, NOW);
    const headline = convertedSum(
      wallets.map((w) => ({
        amount: computeBalances([w], txs)[w.id] ?? w.initialBalance,
        currency: w.currency,
        date: NOW.toISOString(),
      })),
      "MGA",
      rates,
    ).total;
    expect(series.at(-1)).toBe(headline);
    expect(series.at(-1)).toBe(1300);
  });

  it("un jour passé n'inclut pas les opérations des jours suivants", () => {
    const txs = [tx("t1", new Date(2026, 10, 9, 10), "income", 500)];
    const series = dailyTotals(wallets, txs, days, "MGA", rates, undefined, NOW);
    expect(series).toEqual([1000, 1500, 1500]);
  });

  it("les opérations datées dans le futur n'apparaissent pas avant leur date", () => {
    const txs = [tx("futur", new Date(2026, 10, 12, 10), "expense", 300)];
    const series = dailyTotals(wallets, txs, days, "MGA", rates, undefined, NOW);
    expect(series).toEqual([1000, 1000, 1000]);
  });

  it("avec la coupure « solde futur », le dernier point suit la coupure", () => {
    const txs = [tx("futur", new Date(2026, 10, 12, 10), "expense", 300)];
    const series = dailyTotals(wallets, txs, days, "MGA", rates, NOW, NOW);
    expect(series.at(-1)).toBe(1000);
  });
});

describe("mini-graphique des dépenses", () => {
  it("compte les dépenses de chaque jour, sans les revenus ni les virements", () => {
    const txs = [
      tx("d1", new Date(2026, 10, 8, 9), "expense", 120),
      tx("d2", new Date(2026, 10, 8, 18), "expense", 80),
      tx("r1", new Date(2026, 10, 9, 9), "income", 999),
      tx("v1", new Date(2026, 10, 10, 9), "transfer", 50),
      tx("d3", new Date(2026, 10, 10, 10), "expense", 40),
    ];
    expect(dailyExpenses(txs, days, "MGA")).toEqual([200, 0, 40]);
  });
});
