/**
 * Format natif CSV (SPEC §5.13) :
 *   Date, Type, Category, Amount, Currency, Memo, Wallet
 * - Date : « MM/DD/YYYY, HH:mm » (l'heure est facultative, 00:00 par défaut).
 * - Virement : une seule ligne, Wallet = « A -> B », montant positif.
 * - Dépense, revenu : montant positif, le signe vient du type.
 * - Ajustement : montant signé.
 */

export const NATIVE_HEADERS = [
  "Date",
  "Type",
  "Category",
  "Amount",
  "Currency",
  "Memo",
  "Wallet",
] as const;

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?$/;

/** « MM/DD/YYYY, HH:mm » → ISO UTC (heure locale interprétée). Retourne null si invalide. */
export function parseNativeDate(raw: string): string | null {
  const value = raw.trim();
  const match = DATE_RE.exec(value);
  if (!match) {
    // Repli : ISO 8601 accepté tel quel.
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const date = new Date(year, month - 1, day, hour, minute);
  // Rejette les dates qui débordent (ex. 02/31).
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
}

/** ISO UTC → « MM/DD/YYYY, HH:mm » (heure locale). */
export function formatNativeDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** « A -> B » (ou « A → B ») → [A, B]. Retourne null si le séparateur est absent. */
export function splitTransferWallets(raw: string): [string, string] | null {
  const parts = raw.split(/\s*(?:->|→)\s*/);
  if (parts.length !== 2) return null;
  const [from = "", to = ""] = parts.map((p) => p.trim());
  if (from === "" || to === "") return null;
  return [from, to];
}
