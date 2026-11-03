import Papa from "papaparse";
import ExcelJS from "exceljs";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import type { Transaction, Wallet } from "../../db/entities";
import { computeBalances } from "../../domain/balance";
import { minorToPlainText } from "../../lib/amount-text";
import { formatNativeDate, NATIVE_HEADERS } from "./csv-format";

export interface ExportNames {
  wallets: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
}

export async function loadExportNames(database: AppDatabase = defaultDb): Promise<ExportNames> {
  const [wallets, categories] = await Promise.all([
    database.wallets.toArray(),
    database.categories.toArray(),
  ]);
  return {
    wallets: new Map(wallets.map((w) => [w.id, w.name])),
    categories: new Map(categories.map((c) => [c.id, c.name])),
  };
}

/** Lignes au format natif : les virements sont une seule ligne « A -> B ». */
function nativeRows(transactions: readonly Transaction[], names: ExportNames): string[][] {
  return transactions.map((t) => {
    const from = names.wallets.get(t.walletId) ?? "";
    const to = t.toWalletId ? (names.wallets.get(t.toWalletId) ?? "") : "";
    return [
      formatNativeDate(t.date),
      t.type,
      t.categoryId ? (names.categories.get(t.categoryId) ?? "") : "",
      minorToPlainText(t.type === "adjustment" ? t.amount : Math.abs(t.amount), t.currency),
      t.currency,
      t.memo,
      t.type === "transfer" ? `${from} -> ${to}` : from,
    ];
  });
}

export function transactionsToCsv(
  transactions: readonly Transaction[],
  names: ExportNames,
): string {
  return Papa.unparse(
    { fields: [...NATIVE_HEADERS], data: nativeRows(transactions, names) },
    { delimiter: "," },
  );
}

export function transactionsToJson(
  transactions: readonly Transaction[],
  names: ExportNames,
): string {
  const payload = {
    format: "money-manager/transactions",
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: transactions.map((t) => ({
      date: t.date,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      wallet: names.wallets.get(t.walletId) ?? "",
      toWallet: t.toWalletId ? (names.wallets.get(t.toWalletId) ?? "") : undefined,
      toAmount: t.toAmount,
      fee: t.fee,
      category: t.categoryId ? (names.categories.get(t.categoryId) ?? "") : undefined,
      memo: t.memo,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/** Classeur : feuille « Transactions » et feuille « Résumé » (soldes par portefeuille). */
export async function transactionsToXlsx(
  transactions: readonly Transaction[],
  names: ExportNames,
  wallets: readonly Wallet[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Transactions");
  sheet.addRow([...NATIVE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const row of nativeRows(transactions, names)) sheet.addRow(row);
  sheet.columns.forEach((column) => {
    column.width = 18;
  });

  const summary = workbook.addWorksheet("Résumé");
  summary.addRow(["Portefeuille", "Devise", "Solde"]);
  summary.getRow(1).font = { bold: true };
  const balances = computeBalances(wallets, transactions);
  for (const wallet of wallets) {
    summary.addRow([
      wallet.name,
      wallet.currency,
      minorToPlainText(balances[wallet.id] ?? wallet.initialBalance, wallet.currency),
    ]);
  }
  summary.columns.forEach((column) => {
    column.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
