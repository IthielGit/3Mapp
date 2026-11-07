import { afterEach, describe, expect, it } from "vitest";
import { contrastRatio, parseHex, readableTextOn } from "../../src/lib/contrast";
import { fitsWalletCard, heroAmountClass } from "../../src/lib/amount-fit";
import { formatMoney, formatMoneyCompact, setAmountFormat } from "../../src/lib/money";

const NBSP = " ";
const MINUS = "−";

describe("parseHex / contrastRatio", () => {
  it("lit #rgb et #rrggbb, refuse le reste", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("0B7E9D")).toEqual([11, 126, 157]);
    expect(parseHex("rgb(0,0,0)")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  it("noir sur blanc = 21:1, blanc sur Cyan Lagon ≈ 4,68:1", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [11, 126, 157])).toBeCloseTo(4.68, 2);
  });
});

describe("readableTextOn", () => {
  it("couleurs claires → Encre Charbon", () => {
    expect(readableTextOn("#FFFFFF")).toBe("ink");
    expect(readableTextOn("#FFEB3B")).toBe("ink"); // jaune
    expect(readableTextOn("#90EE90")).toBe("ink"); // vert clair
    expect(readableTextOn("#0FA7D1")).toBe("ink"); // Cyan Peu Profond : texte charbon (DESIGN.md)
    expect(readableTextOn("#65a30d")).toBe("ink"); // vert moyen de la palette
  });

  it("couleurs foncées → blanc", () => {
    expect(readableTextOn("#000000")).toBe("white");
    expect(readableTextOn("#0B7E9D")).toBe("white");
    expect(readableTextOn("#475569")).toBe("white");
    expect(readableTextOn("#dc2626")).toBe("white");
    expect(readableTextOn("#4f46e5")).toBe("white");
  });

  it("couleur illisible → blanc (comportement historique)", () => {
    expect(readableTextOn("teal")).toBe("white");
  });
});

describe("heroAmountClass", () => {
  it("36 px par défaut, puis 30, 24 et 18 px selon la longueur", () => {
    expect(heroAmountClass(formatMoney(-125_000_000, "MGA"))).toBe("text-4xl"); // 15 caractères
    expect(heroAmountClass(formatMoney(-1_250_000_000, "MGA"))).toBe("text-3xl"); // 17
    expect(heroAmountClass(formatMoney(-12_500_000_000, "MGA"))).toBe("text-3xl"); // 18
    expect(heroAmountClass(formatMoney(-125_000_000_000, "MGA"))).toBe("text-2xl"); // 19
    expect(heroAmountClass(formatMoney(Number.MIN_SAFE_INTEGER, "MGA"))).toBe("text-lg"); // 25
  });

  it("petit montant : Amount Hero", () => {
    expect(heroAmountClass(formatMoney(0, "MGA"))).toBe("text-4xl");
  });
});

describe("fitsWalletCard", () => {
  it("jusqu'à 15 caractères le montant complet tient", () => {
    expect(fitsWalletCard(formatMoney(-125_000_000, "MGA"))).toBe(true);
    expect(fitsWalletCard(formatMoney(-1_250_000_000, "MGA"))).toBe(false);
  });
});

describe("formatMoneyCompact", () => {
  afterEach(() => setAmountFormat(undefined));

  it("sous un million : montant complet", () => {
    expect(formatMoneyCompact(999_999, "MGA")).toBe(formatMoney(999_999, "MGA"));
    expect(formatMoneyCompact(99_999_999, "EUR")).toBe(formatMoney(99_999_999, "EUR"));
  });

  it("millions et milliards en français", () => {
    expect(formatMoneyCompact(1_250_000_000, "MGA")).toBe(`1,25${NBSP}Md${NBSP}Ar`);
    expect(formatMoneyCompact(3_400_000, "MGA")).toBe(`3,4${NBSP}M${NBSP}Ar`);
    expect(formatMoneyCompact(1_000_000, "MGA")).toBe(`1${NBSP}M${NBSP}Ar`);
    expect(formatMoneyCompact(12_345_678, "MGA")).toBe(`12,3${NBSP}M${NBSP}Ar`);
    expect(formatMoneyCompact(-1_250_000_000, "MGA")).toBe(`${MINUS}1,25${NBSP}Md${NBSP}Ar`);
  });

  it("tronque au lieu d'arrondir vers le haut", () => {
    expect(formatMoneyCompact(999_999_999, "MGA")).toBe(`999${NBSP}M${NBSP}Ar`);
    expect(formatMoneyCompact(1_999_000, "MGA")).toBe(`1,99${NBSP}M${NBSP}Ar`);
  });

  it("anglais : B pour les milliards, séparateurs du réglage", () => {
    expect(formatMoneyCompact(1_250_000_000, "MGA", "en")).toBe(`1,25${NBSP}B${NBSP}Ar`);
    setAmountFormat("comma");
    expect(formatMoneyCompact(1_250_000_000, "MGA", "en")).toBe(`1.25${NBSP}B${NBSP}Ar`);
  });

  it("respecte les décimales et la position du symbole", () => {
    // 3 400 000,00 € = 340 000 000 centimes.
    expect(formatMoneyCompact(340_000_000, "EUR")).toBe(`3,4${NBSP}M${NBSP}€`);
    expect(formatMoneyCompact(250_000_000_000, "USD", "en")).toBe(`$2,5${NBSP}B`);
  });

  it("très grands montants : milliers de milliards groupés", () => {
    expect(formatMoneyCompact(1_250_000_000_000, "MGA")).toBe(`1.250${NBSP}Md${NBSP}Ar`);
  });
});
