import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { computeBalances } from "../../src/domain/balance";
import {
  formatNativeDate,
  parseNativeDate,
  splitTransferWallets,
} from "../../src/features/import-export/csv-format";
import {
  autoMapping,
  buildRows,
  decodeBytes,
  detectSeparator,
  executeImport,
  existingSignatures,
  parseCsvText,
  planImport,
} from "../../src/features/import-export/csv-import";
import { loadExportNames, transactionsToCsv } from "../../src/features/import-export/export";
import { createWallet } from "../../src/features/wallets/wallet-service";
import { createTransaction } from "../../src/features/transactions/transaction-service";
import { createCategory } from "../../src/features/categories/category-service";

let db: AppDatabase;
let other: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`test-${crypto.randomUUID()}`);
  other = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
  await other.delete();
});

const HEADER = "Date,Type,Category,Amount,Currency,Memo,Wallet";

describe("format natif", () => {
  it("dates MM/DD/YYYY, HH:mm (aller-retour)", () => {
    const iso = new Date(2026, 1, 3, 14, 5).toISOString();
    expect(formatNativeDate(iso)).toBe("02/03/2026, 14:05");
    expect(parseNativeDate("02/03/2026, 14:05")).toBe(iso);
    expect(parseNativeDate("02/03/2026")).toBe(new Date(2026, 1, 3, 0, 0).toISOString());
  });

  it("refuse les dates impossibles", () => {
    expect(parseNativeDate("02/31/2026")).toBeNull();
    expect(parseNativeDate("13/01/2026")).toBeNull();
    expect(parseNativeDate("pas une date")).toBeNull();
  });

  it("virement « A -> B »", () => {
    expect(splitTransferWallets("BNI -> Espèces")).toEqual(["BNI", "Espèces"]);
    expect(splitTransferWallets("BNI")).toBeNull();
  });
});

describe("lecture du fichier", () => {
  it("détecte le séparateur", () => {
    expect(detectSeparator("a;b;c\n1;2;3")).toBe(";");
    expect(detectSeparator("a\tb\tc")).toBe("\t");
    expect(detectSeparator("a,b,c")).toBe(",");
  });

  it("décode UTF-8 et, à défaut, Windows-1252", () => {
    const utf8 = new TextEncoder().encode("Épargne").buffer;
    expect(decodeBytes(utf8)).toBe("Épargne");
    const cp1252 = new Uint8Array([0xc9, 0x70, 0x61, 0x72, 0x67, 0x6e, 0x65]).buffer;
    expect(decodeBytes(cp1252)).toBe("Épargne");
  });

  it("mappe automatiquement les en-têtes français et anglais", () => {
    const file = parseCsvText("Date;Type;Catégorie;Montant;Devise;Mémo;Compte\n");
    const mapping = autoMapping(file.headers);
    expect(mapping.category).toBe("Catégorie");
    expect(mapping.amount).toBe("Montant");
    expect(mapping.wallet).toBe("Compte");
  });
});

describe("lignes et erreurs", () => {
  it("une ligne correcte n’a pas d’erreur et le montant est positif", () => {
    const file = parseCsvText(
      [HEADER, '"02/03/2026, 10:00",expense,Food,-12,MGA,Bon,BNI'].join("\n"),
    );
    const rows = buildRows(file, autoMapping(file.headers), "MGA");
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[0]?.amount).toBe(12);
  });

  it("montant avec décimales non admises par la devise : erreur, pas d’arrondi silencieux", () => {
    const file = parseCsvText([HEADER, "02/03/2026,expense,,12.5,MGA,,BNI"].join("\n"));
    const rows = buildRows(file, autoMapping(file.headers), "MGA");
    expect(rows[0]?.errors.length).toBeGreaterThan(0);
  });

  it("type inconnu et virement sans « A -> B » sont des erreurs", () => {
    const file = parseCsvText(
      [HEADER, "02/03/2026,unknown,,100,MGA,,BNI", "02/03/2026,transfer,,100,MGA,,BNI"].join("\n"),
    );
    const rows = buildRows(file, autoMapping(file.headers), "MGA");
    expect(rows[0]?.errors.length).toBeGreaterThan(0);
    expect(rows[1]?.errors.length).toBeGreaterThan(0);
  });
});

describe("import, doublons et aller-retour", () => {
  async function seed() {
    const bank = await createWallet(
      {
        name: "BNI",
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 500000,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    const cash = await createWallet(
      {
        name: "Espèces",
        icon: "💵",
        color: "#000000",
        group: "cash",
        currency: "MGA",
        initialBalance: 0,
        includeInTotal: true,
        archived: false,
      },
      db,
    );
    const food = await createCategory(
      { name: "Alimentation", kind: "expense", icon: "🍽️", color: "#000000", archived: false },
      db,
    );
    const salary = await createCategory(
      { name: "Salaire", kind: "income", icon: "💼", color: "#000000", archived: false },
      db,
    );
    const base = { attachmentIds: [] as string[], status: "posted" as const };
    await createTransaction(
      {
        ...base,
        type: "income",
        amount: 1200000,
        walletId: bank.id,
        categoryId: salary.id,
        memo: "Paie",
        date: new Date(2026, 0, 10, 9, 30).toISOString(),
      },
      db,
    );
    await createTransaction(
      {
        ...base,
        type: "expense",
        amount: 45000,
        walletId: bank.id,
        categoryId: food.id,
        memo: "Riz",
        date: new Date(2026, 0, 11, 12).toISOString(),
      },
      db,
    );
    await createTransaction(
      {
        ...base,
        type: "transfer",
        amount: 100000,
        walletId: bank.id,
        toWalletId: cash.id,
        memo: "Retrait",
        date: new Date(2026, 0, 12, 8).toISOString(),
      },
      db,
    );
    await createTransaction(
      {
        ...base,
        type: "adjustment",
        amount: -2000,
        walletId: cash.id,
        memo: "Ajustement",
        date: new Date(2026, 0, 13, 18).toISOString(),
      },
      db,
    );
  }

  it("export puis import dans une base vierge : soldes identiques", async () => {
    await seed();
    const names = await loadExportNames(db);
    const csv = transactionsToCsv(await db.transactions.toArray(), names);

    const file = parseCsvText(csv);
    const rows = buildRows(file, autoMapping(file.headers), "MGA");
    const result = await executeImport(planImport(rows, await existingSignatures(other)), other);
    expect(result.created).toBe(4);
    expect(result.invalid).toHaveLength(0);

    const originalWallets = await db.wallets.toArray();
    const copiedWallets = await other.wallets.toArray();
    const originalBalances = computeBalances(originalWallets, await db.transactions.toArray());
    const copiedBalances = computeBalances(copiedWallets, await other.transactions.toArray());
    // Le format natif ne porte pas le solde initial : on compare les variations (critère Phase 4).
    const variation = (ws: typeof originalWallets, b: Record<string, number>) =>
      Object.fromEntries(ws.map((w) => [w.name, (b[w.id] ?? 0) - w.initialBalance]));
    expect(variation(copiedWallets, copiedBalances)).toEqual(
      variation(originalWallets, originalBalances),
    );
  });

  it("second import identique : zéro nouvelle transaction", async () => {
    await seed();
    const names = await loadExportNames(db);
    const csv = transactionsToCsv(await db.transactions.toArray(), names);
    const file = parseCsvText(csv);
    const rows = buildRows(file, autoMapping(file.headers), "MGA");

    const first = await executeImport(planImport(rows, await existingSignatures(other)), other);
    expect(first.created).toBe(4);
    const second = await executeImport(planImport(rows, await existingSignatures(other)), other);
    expect(second.created).toBe(0);
    expect(second.duplicates).toBe(4);
    expect(await other.transactions.count()).toBe(4);
  });

  it("doublons à l’intérieur du même fichier détectés", () => {
    const line = '"02/03/2026, 10:00",expense,Food,1000,MGA,Bon,BNI';
    const file = parseCsvText([HEADER, line, line].join("\n"));
    const rows = buildRows(file, autoMapping(file.headers), "MGA");
    const plan = planImport(rows, []);
    expect(plan.valid).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(1);
  });
});
