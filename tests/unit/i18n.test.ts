import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import en from "../../src/i18n/en.json";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [p, v] of leaves(value, path)) out.set(p, v);
  }
  return out;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] ?? "").sort();
}

const reference = leaves(fr as unknown as Tree);

describe("traductions (SPEC §5.17)", () => {
  for (const [name, locale] of [
    ["anglais", en],
  ] as const) {
    const translated = leaves(locale as unknown as Tree);

    it(`${name} : toutes les clés du français sont présentes`, () => {
      const missing = [...reference.keys()].filter((key) => !translated.has(key));
      expect(missing).toEqual([]);
    });

    it(`${name} : aucune clé en trop et aucune valeur vide`, () => {
      const extra = [...translated.keys()].filter((key) => !reference.has(key));
      expect(extra).toEqual([]);
      const empty = [...translated].filter(([, value]) => value.trim() === "").map(([k]) => k);
      expect(empty).toEqual([]);
    });

    it(`${name} : mêmes variables {{…}} que le français`, () => {
      const mismatched = [...reference].filter(([key, value]) => {
        const other = translated.get(key);
        return other !== undefined && placeholders(value).join() !== placeholders(other).join();
      });
      expect(mismatched.map(([key]) => key)).toEqual([]);
    });
  }
});
