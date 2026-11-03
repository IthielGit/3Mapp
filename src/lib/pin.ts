/**
 * PIN (SPEC §5.15) : jamais stocké en clair. On dérive une empreinte PBKDF2-SHA256 avec un sel aléatoire.
 * Tout passe par Web Crypto.
 */

const ITERATIONS = 210_000;
const HASH_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toBase64(salt);
}

/** Un PIN valide a entre 4 et 6 chiffres. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64(saltBase64), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    HASH_BYTES * 8,
  );
  return toBase64(new Uint8Array(bits));
}

/** Comparaison en temps constant sur la longueur des empreintes. */
export async function verifyPin(
  pin: string,
  saltBase64: string,
  expectedHashBase64: string,
): Promise<boolean> {
  const candidate = fromBase64(await hashPin(pin, saltBase64));
  const expected = fromBase64(expectedHashBase64);
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= (candidate[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}
