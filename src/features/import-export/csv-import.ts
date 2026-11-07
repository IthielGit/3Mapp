import Papa from "papaparse";
import { transactionSchema, type Transaction } from "../../db/entities";
import { db as defaultDb, type AppDatabase } from "../../db/database";
import { CURRENCIES, parseMoney, type CurrencyCode, type Minor } from "../../lib/money";
import {
  isAmbiguousDate,
  parseNativeDate,
  splitTransferWallets,
  type DateOrder,
} from "./csv-format";

export type ImportField = "date" | "type" | "category" | "amount" | "currency" | "memo" | "wallet";
export const IMPORT_FIELDS: ImportField[] = [
  "date",
  "type",
  "category",
  "amount",
  "currency",
  "memo",
  "wallet",
];
export const REQUIRED_FIELDS: ImportField[] = ["date", "type", "amount", "wallet"];

/** Colonne du fichier associée à chaque champ (null = non mappé). */
export type Mapping = Partial<Record<ImportField, string | null>>;

export interface ParsedRow {
  line: number;
  date: string;
  type: Transaction["type"];
  categoryName: string;
  amount: Minor;
  currency: CurrencyCode;
  memo: string;
  walletName: string;
  toWalletName: string;
  /** La date peut se lire dans les deux sens (ex. 02/11/2026) : l'ordre choisi a été appliqué. */
  dateAmbiguous: boolean;
  errors: string[];
}

export interface ParsedFile {
  headers: string[];
  rows: string[][];
  separator: string;
}

/** Décode des octets : UTF-8 si valide, sinon Windows-1252 (fichiers exportés depuis Excel). */
export function decodeBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(new RegExp("^" + String.fromCharCode(0xfeff)), "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Choisit le séparateur le plus fréquent dans la première ligne : virgule, point-virgule ou tabulation. */
export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const sep of candidates) {
    const count = firstLine.split(sep).length - 1;
    if (count > bestCount) {
      best = sep;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsvText(text: string): ParsedFile {
  const separator = detectSeparator(text);
  const result = Papa.parse<string[]>(text, { delimiter: separator, skipEmptyLines: "greedy" });
  const [headerRow = [], ...rows] = result.data;
  return {
    headers: headerRow.map((h) => h.trim()),
    rows,
    separator,
  };
}

function normalise(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const SYNONYMS: Record<ImportField, string[]> = {
  date: ["date", "date et heure", "datetime"],
  type: ["type"],
  category: ["category", "categorie", "catégorie"],
  amount: ["amount", "montant"],
  currency: ["currency", "devise"],
  memo: ["memo", "mémo", "note", "description"],
  wallet: ["wallet", "portefeuille", "compte", "account"],
};

/** Associe automatiquement les colonnes du fichier aux champs (en-têtes français ou anglais). */
export function autoMapping(headers: readonly string[]): Mapping {
  const mapping: Mapping = {};
  for (const field of IMPORT_FIELDS) {
    const match = headers.find((h) => SYNONYMS[field].includes(normalise(h)));
    mapping[field] = match ?? null;
  }
  return mapping;
}

const TYPE_ALIASES: Record<string, Transaction["type"]> = {
  expense: "expense",
  depense: "expense",
  dépense: "expense",
  income: "income",
  revenu: "income",
  transfer: "transfer",
  virement: "transfer",
  adjustment: "adjustment",
  ajustement: "adjustment",
};

function cell(
  row: string[],
  headers: readonly string[],
  column: string | null | undefined,
): string {
  if (!column) return "";
  const index = headers.indexOf(column);
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

/** Transforme les lignes brutes en lignes typées, avec la liste des erreurs de chaque ligne. */
export function buildRows(
  file: ParsedFile,
  mapping: Mapping,
  baseCurrency: CurrencyCode,
  dateOrder: DateOrder = "dmy",
): ParsedRow[] {
  return file.rows.map((raw, index) => {
    const errors: string[] = [];
    const line = index + 2; // ligne 1 = en-tête

    const dateRaw = cell(raw, file.headers, mapping.date);
    const date = parseNativeDate(dateRaw, dateOrder) ?? "";
    if (date === "") {
      errors.push(
        dateOrder === "dmy"
          ? "Date invalide (attendu : JJ/MM/AAAA, HH:mm)"
          : "Date invalide (attendu : MM/JJ/AAAA, HH:mm)",
      );
    }
    const dateAmbiguous = isAmbiguousDate(dateRaw);

    const typeRaw = normalise(cell(raw, file.headers, mapping.type));
    const type =
      TYPE_ALIASES[typeRaw] ?? TYPE_ALIASES[cell(raw, file.headers, mapping.type).toLowerCase()];
    if (!type) errors.push("Type inconnu");

    const currencyRaw = cell(raw, file.headers, mapping.currency).toUpperCase();
    const currency: CurrencyCode =
      currencyRaw === "" ? baseCurrency : (currencyRaw as CurrencyCode);
    if (!(currency in CURRENCIES)) errors.push(`Devise inconnue : ${currencyRaw}`);

    const amountRaw = cell(raw, file.headers, mapping.amount);
    let amount: Minor = 0;
    const parsedAmount = currency in CURRENCIES ? parseMoney(amountRaw, currency) : null;
    if (parsedAmount === null) {
      errors.push(`Montant invalide : « ${amountRaw} »`);
    } else {
      // Dépense, revenu, virement : montant positif. L'ajustement garde son signe.
      amount = type === "adjustment" ? parsedAmount : Math.abs(parsedAmount);
    }

    let walletName = "";
    let toWalletName = "";
    const walletRaw = cell(raw, file.headers, mapping.wallet);
    if (type === "transfer") {
      const pair = splitTransferWallets(walletRaw);
      if (!pair) errors.push("Virement : le portefeuille doit être « A -> B »");
      else [walletName, toWalletName] = pair;
    } else {
      walletName = walletRaw;
      if (walletName === "") errors.push("Portefeuille manquant");
    }

    // Dépense et revenu : catégorie obligatoire (comme à la saisie). Une ligne sans catégorie est rejetée.
    const categoryName = cell(raw, file.headers, mapping.category);
    if ((type === "expense" || type === "income") && categoryName === "") {
      errors.push("Catégorie manquante");
    }

    return {
      line,
      date,
      type: type ?? "expense",
      categoryName,
      amount,
      currency,
      memo: cell(raw, file.headers, mapping.memo),
      walletName,
      toWalletName,
      dateAmbiguous,
      errors,
    };
  });
}

/** Empreinte d'une transaction pour détecter les doublons (date + type + montant + portefeuilles + mémo). */
export function signature(row: {
  date: string;
  type: string;
  amount: number;
  walletName: string;
  toWalletName?: string;
  memo: string;
}): string {
  return [
    row.date,
    row.type,
    row.amount,
    row.walletName.toLowerCase(),
    (row.toWalletName ?? "").toLowerCase(),
    row.memo.trim(),
  ].join("|");
}

export interface ImportPlan {
  valid: ParsedRow[];
  duplicates: ParsedRow[];
  invalid: ParsedRow[];
}

/** Sépare les lignes valides, les doublons (dans le fichier ou déjà en base) et les lignes invalides. */
export function planImport(rows: ParsedRow[], existing: readonly string[]): ImportPlan {
  const seen = new Set(existing);
  const plan: ImportPlan = { valid: [], duplicates: [], invalid: [] };
  for (const row of rows) {
    if (row.errors.length > 0) {
      plan.invalid.push(row);
      continue;
    }
    const key = signature(row);
    if (seen.has(key)) {
      plan.duplicates.push(row);
    } else {
      seen.add(key);
      plan.valid.push(row);
    }
  }
  return plan;
}

/** Signatures des transactions existantes, avec les noms des portefeuilles. */
export async function existingSignatures(database: AppDatabase = defaultDb): Promise<string[]> {
  const wallets = new Map((await database.wallets.toArray()).map((w) => [w.id, w.name]));
  const transactions = await database.transactions.toArray();
  return transactions.map((t) =>
    signature({
      date: t.date,
      type: t.type,
      amount: t.type === "adjustment" ? t.amount : Math.abs(t.amount),
      walletName: wallets.get(t.walletId) ?? "",
      toWalletName: t.toWalletId ? (wallets.get(t.toWalletId) ?? "") : "",
      memo: t.memo,
    }),
  );
}

export interface ImportResult {
  created: number;
  duplicates: number;
  invalid: { line: number; message: string }[];
  walletsCreated: number;
  categoriesCreated: number;
}

/**
 * Écrit les lignes valides : crée les portefeuilles et catégories manquants, puis les transactions.
 * Tout ou rien : une erreur de validation annule l'import entier.
 */
export async function executeImport(
  plan: ImportPlan,
  database: AppDatabase = defaultDb,
  options: { now?: string } = {},
): Promise<ImportResult> {
  const now = options.now ?? new Date().toISOString();
  const result: ImportResult = {
    created: 0,
    duplicates: plan.duplicates.length,
    invalid: plan.invalid.map((r) => ({ line: r.line, message: r.errors.join(" ; ") })),
    walletsCreated: 0,
    categoriesCreated: 0,
  };

  await database.transaction(
    "rw",
    [database.wallets, database.categories, database.transactions],
    async () => {
      const wallets = await database.wallets.toArray();
      const walletByName = new Map(wallets.map((w) => [w.name.toLowerCase(), w]));
      const categories = await database.categories.toArray();
      const categoryKey = (name: string, kind: "expense" | "income") =>
        `${kind}|${name.toLowerCase()}`;
      const categoryByKey = new Map(categories.map((c) => [categoryKey(c.name, c.kind), c]));
      let nextWalletOrder = wallets.reduce((max, w) => Math.max(max, w.sortOrder), -1) + 1;
      let nextCategoryOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

      const ensureWallet = async (name: string, currency: CurrencyCode) => {
        const key = name.toLowerCase();
        const found = walletByName.get(key);
        if (found) return found;
        const wallet = {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          name,
          icon: "💼",
          color: "#0B7E9D",
          currency,
          initialBalance: 0,
          sortOrder: nextWalletOrder++,
          includeInTotal: true,
          group: "cash" as const,
          archived: false,
        };
        await database.wallets.add(wallet);
        walletByName.set(key, wallet);
        result.walletsCreated++;
        return wallet;
      };

      const ensureCategory = async (name: string, kind: "expense" | "income") => {
        const key = categoryKey(name, kind);
        const found = categoryByKey.get(key);
        if (found) return found;
        const category = {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          name,
          kind,
          icon: "📦",
          color: "#64748b",
          sortOrder: nextCategoryOrder++,
          archived: false,
        };
        await database.categories.add(category);
        categoryByKey.set(key, category);
        result.categoriesCreated++;
        return category;
      };

      const records: Transaction[] = [];
      for (const row of plan.valid) {
        const source = await ensureWallet(row.walletName, row.currency);
        if (source.currency !== row.currency) {
          throw new Error(
            `Ligne ${row.line} : devise ${row.currency} différente du portefeuille ${source.name}`,
          );
        }
        const target = row.toWalletName
          ? await ensureWallet(row.toWalletName, row.currency)
          : undefined;
        if (target && target.currency !== row.currency) {
          throw new Error(
            `Ligne ${row.line} : le portefeuille ${target.name} n'est pas en ${row.currency}`,
          );
        }
        const isCategorised = row.type === "expense" || row.type === "income";
        const category =
          isCategorised && row.categoryName
            ? await ensureCategory(row.categoryName, row.type as "expense" | "income")
            : undefined;

        const candidate = {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          type: row.type,
          amount: row.amount,
          currency: row.currency,
          walletId: source.id,
          toWalletId: target?.id,
          categoryId: category?.id,
          memo: row.memo,
          attachmentIds: [] as string[],
          date: row.date,
          status: "posted" as const,
        };
        const parsed = transactionSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new Error(
            `Ligne ${row.line} : ${parsed.error.issues[0]?.message ?? "transaction invalide"}`,
          );
        }
        records.push(parsed.data);
      }

      for (let i = 0; i < records.length; i += 500) {
        await database.transactions.bulkAdd(records.slice(i, i + 500));
      }
      result.created = records.length;
    },
  );

  return result;
}
