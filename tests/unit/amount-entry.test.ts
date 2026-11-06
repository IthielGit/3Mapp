import { describe, expect, it } from "vitest";
import {
  formatExpressionForDisplay,
  rawFromDisplay,
  rawIndexFromDisplay,
} from "../../src/lib/amount-entry";
import { minorToEntryText } from "../../src/lib/amount-text";

const NNBSP = "\u202F";

describe("formatExpressionForDisplay", () => {
  it("groupe les milliers à la saisie (format par points)", () => {
    expect(formatExpressionForDisplay("1500", "dot").text).toBe("1.500");
    expect(formatExpressionForDisplay("1500000", "dot").text).toBe("1.500.000");
    expect(formatExpressionForDisplay("12", "dot").text).toBe("12");
  });

  it("garde la décimale saisie et groupe seulement la partie entière", () => {
    expect(formatExpressionForDisplay("1500,5", "dot").text).toBe("1.500,5");
    expect(formatExpressionForDisplay("1500,", "dot").text).toBe("1.500,");
    expect(formatExpressionForDisplay("1234567,89", "dot").text).toBe("1.234.567,89");
  });

  it("groupe chaque nombre d'une expression", () => {
    expect(formatExpressionForDisplay("1000+2500×3", "dot").text).toBe("1.000+2.500×3");
    expect(formatExpressionForDisplay("(1000−20)÷2", "dot").text).toBe("(1.000−20)÷2");
  });

  it("applique le style choisi aux séparateurs", () => {
    expect(formatExpressionForDisplay("1500000,5", "space").text).toBe(`1${NNBSP}500${NNBSP}000,5`);
    expect(formatExpressionForDisplay("1500000,5", "comma").text).toBe("1,500,000.5");
    expect(formatExpressionForDisplay("1500000,5", "plain").text).toBe("1500000,5");
  });

  it("ne groupe pas les décimales (,000 après la virgule reste tel quel)", () => {
    expect(formatExpressionForDisplay("1,0005", "dot").text).toBe("1,0005");
  });

  it("donne la position d'affichage de chaque position brute", () => {
    // « 1500 » → « 1.500 » : le curseur entre le 1 et le 5 (brut 1) passe après le point (affichage 2).
    const { toDisplay } = formatExpressionForDisplay("1500", "dot");
    expect(toDisplay).toEqual([0, 2, 3, 4, 5]);
  });
});

describe("rawFromDisplay / rawIndexFromDisplay", () => {
  it("revient à l'expression brute pour chaque style", () => {
    for (const format of ["dot", "space", "comma", "plain"] as const) {
      for (const raw of ["1500", "1500,25", "1234567+20×3", "12,5÷2"]) {
        const display = formatExpressionForDisplay(raw, format).text;
        expect(rawFromDisplay(display, format), `${format} ${raw}`).toBe(raw);
      }
    }
  });

  it("traduit la position du curseur entre affichage et brut", () => {
    // « 1.500 » : le curseur après le point (affichage 2) correspond à la position brute 1.
    expect(rawIndexFromDisplay("1.500", 2, "dot")).toBe(1);
    expect(rawIndexFromDisplay("1.500", 5, "dot")).toBe(4);
  });

  it("une saisie tapée dans le champ reformate et garde le curseur", () => {
    // Le champ affiche « 1.500 » ; l'utilisateur tape 0 en fin : « 1.5000 » → brut « 15000 » → « 15.000 ».
    const typed = "1.5000";
    const raw = rawFromDisplay(typed, "dot");
    expect(raw).toBe("15000");
    expect(formatExpressionForDisplay(raw, "dot").text).toBe("15.000");
    expect(rawIndexFromDisplay(typed, typed.length, "dot")).toBe(5);
  });
});

describe("minorToEntryText", () => {
  it("écrit la décimale avec une virgule, comme la saisie", () => {
    expect(minorToEntryText(1250, "EUR")).toBe("12,50");
    expect(minorToEntryText(1500, "MGA")).toBe("1500");
    expect(minorToEntryText(-500, "EUR")).toBe("-5,00");
  });
});
