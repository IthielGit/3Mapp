/**
 * Format natif CSV (SPEC §5.13) :
 *   Date, Type, Category, Amount, Currency, Memo, Wallet
 * - Date à l'export : « MM/DD/YYYY, HH:mm » (l'heure est facultative, 00:00 par défaut).
 *   À l'import : JJ/MM/YYYY ou MM/JJ/YYYY selon le choix de l'utilisateur, ou ISO 8601.
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

/**
 * Ordre des deux premiers nombres d'une date « xx/yy/AAAA » :
 * « dmy » = JJ/MM/AAAA (français, malgache), « mdy » = MM/JJ/AAAA (américain).
 * Par défaut : dmy, car c'est l'écriture courante chez les utilisateurs de l'app.
 */
export type DateOrder = "dmy" | "mdy";

/** Vrai si une date « xx/yy/AAAA » peut se lire dans les deux sens (ex. 02/11/2026). */
export function isAmbiguousDate(raw: string): boolean {
  const match = DATE_RE.exec(raw.trim());
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  return first <= 12 && second <= 12 && first !== second;
}

/** « JJ/MM/YYYY, HH:mm » ou « MM/JJ/YYYY, HH:mm » (selon order) ou ISO → ISO UTC. Null si invalide. */
const LOCAL_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/;

export function parseNativeDate(raw: string, order: DateOrder = "dmy"): string | null {
  const value = raw.trim();
  const iso = LOCAL_ISO_RE.exec(value);
  if (iso) {
    // AAAA-MM-JJ[ HH:mm] sans fuseau : heure locale, comme les autres formats.
    const [year, month, day, hour = "0", minute = "0"] = iso.slice(1);
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return date.toISOString();
  }
  const match = DATE_RE.exec(value);
  if (!match) {
    // Repli : ISO 8601 accepté tel quel.
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  const month = order === "dmy" ? second : first;
  const day = order === "dmy" ? first : second;
  const year = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const date = new Date(year, month - 1, day, hour, minute);
  // Rejette les dates qui débordent (ex. 02/31).
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
}

/**
 * ISO UTC → « AAAA-MM-JJ HH:mm » (heure locale). Ce format n'est pas ambigu : l'app peut le
 * réimporter sans se tromper de jour, quel que soit l'ordre choisi à l'import.
 */
export function formatNativeDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** « A -> B » (ou « A → B ») → [A, B]. Retourne null si le séparateur est absent. */
export function splitTransferWallets(raw: string): [string, string] | null {
  const parts = raw.split(/\s*(?:->|→)\s*/);
  if (parts.length !== 2) return null;
  const [from = "", to = ""] = parts.map((p) => p.trim());
  if (from === "" || to === "") return null;
  return [from, to];
}
