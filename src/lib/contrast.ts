/**
 * Contraste des couleurs (WCAG 2.x) : choisir un texte lisible sur une couleur choisie par l'utilisateur.
 * Fonctions pures ; aucune dépendance au DOM.
 */

/** Encre Charbon (DESIGN.md `ink`) : texte foncé sur fond clair. */
export const INK_HEX = "#223135";
/** Surface blanche : texte clair sur fond foncé. */
export const WHITE_HEX = "#FFFFFF";

export type Rgb = readonly [number, number, number];

const INK: Rgb = [0x22, 0x31, 0x35];
const WHITE: Rgb = [0xff, 0xff, 0xff];

/** « #rgb » ou « #rrggbb » (dièse facultatif) → composantes 0..255 ; null si la couleur est illisible. */
export function parseHex(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, "");
  const full = /^[0-9a-f]{3}$/i.test(raw)
    ? raw
        .split("")
        .map((c) => c + c)
        .join("")
    : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const byte = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return [byte(0), byte(2), byte(4)];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Texte le plus lisible sur un fond donné : « ink » (Encre Charbon) ou « white »,
 * celui qui offre le plus fort contraste. Une couleur illisible garde le blanc (comportement historique).
 */
export function readableTextOn(background: string): "ink" | "white" {
  const bg = parseHex(background);
  if (!bg) return "white";
  return contrastRatio(INK, bg) > contrastRatio(WHITE, bg) ? "ink" : "white";
}
