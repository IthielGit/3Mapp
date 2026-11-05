import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { Transaction, Wallet } from "../../src/db/entities";
import { transactionsToXlsx, type ExportNames } from "../../src/features/import-export/export";

const wallet = {
  id: "w1",
  name: "Banque",
  currency: "MGA",
  initialBalance: 0,
  includeInTotal: true,
  archived: false,
  sortOrder: 0,
} as unknown as Wallet;

const tx = (amount: number, date: string) =>
  ({
    id: `t-${date}`,
    type: "income",
    amount,
    currency: "MGA",
    walletId: "w1",
    status: "posted",
    date,
    memo: "",
    attachmentIds: [],
  }) as unknown as Transaction;

const names: ExportNames = { wallets: new Map([["w1", "Banque"]]), categories: new Map() };

async function summaryBalance(bytes: Uint8Array): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = wb.getWorksheet("Résumé");
  return String(sheet?.getRow(2).getCell(3).value);
}

describe("export XLSX : soldes et coupure du solde futur", () => {
  const transactions = [tx(10000, "2026-01-05T10:00:00.000Z"), tx(50000, "2030-01-05T10:00:00.000Z")];

  it("sans coupure, le solde inclut les mouvements futurs", async () => {
    const bytes = await transactionsToXlsx(transactions, names, [wallet]);
    expect(await summaryBalance(bytes)).toBe("60000");
  });

  it("avec coupure, le solde exclut les mouvements futurs ; les transactions restent toutes exportées", async () => {
    const bytes = await transactionsToXlsx(transactions, names, [wallet], new Date(2026, 5, 1));
    expect(await summaryBalance(bytes)).toBe("10000");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    expect(wb.getWorksheet("Transactions")?.rowCount).toBe(3); // en-tête + 2 transactions
  });
});
