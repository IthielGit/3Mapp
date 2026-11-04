import { describe, expect, it } from "vitest";
import { MoneyError, formatMoney, parseMoney, roundedDivide, sumMinor } from "../../src/lib/money";

const GROUP = ".";
const NBSP = " ";
const MINUS = "−";

describe("formatMoney", () => {
  it("MGA sans décimale, groupé par milliers", () => {
    expect(formatMoney(1500, "MGA")).toBe(`1${GROUP}500${NBSP}Ar`);
    expect(formatMoney(0, "MGA")).toBe(`0${NBSP}Ar`);
  });

  it("EUR à 2 décimales, symbole après", () => {
    expect(formatMoney(1250, "EUR")).toBe(`12,50${NBSP}€`);
    expect(formatMoney(5, "EUR")).toBe(`0,05${NBSP}€`);
  });

  it("USD à 2 décimales, symbole avant", () => {
    expect(formatMoney(1234567, "USD")).toBe(`$12${GROUP}345,67`);
  });

  it("négatifs avec signe moins typographique", () => {
    expect(formatMoney(-1500, "MGA")).toBe(`${MINUS}1${GROUP}500${NBSP}Ar`);
    expect(formatMoney(-5, "EUR")).toBe(`${MINUS}0,05${NBSP}€`);
  });

  it("options : sans symbole et signe plus", () => {
    expect(formatMoney(-1500, "MGA", { withSymbol: false })).toBe(`${MINUS}1${GROUP}500`);
    expect(formatMoney(100, "EUR", { showPlus: true })).toBe(`+1,00${NBSP}€`);
  });

  it("refuse les flottants", () => {
    expect(() => formatMoney(1.5, "EUR")).toThrow(MoneyError);
  });
});

describe("parseMoney", () => {
  it("MGA : entiers, espaces et symbole ignorés", () => {
    expect(parseMoney("1500", "MGA")).toBe(1500);
    expect(parseMoney("1 500", "MGA")).toBe(1500);
    expect(parseMoney(" 1.234.567 Ar ", "MGA")).toBe(1234567);
  });

  it("EUR : décimale virgule ou point", () => {
    expect(parseMoney("12,50", "EUR")).toBe(1250);
    expect(parseMoney("12.5", "EUR")).toBe(1250);
    expect(parseMoney("12,50 €", "EUR")).toBe(1250);
  });

  it("séparateurs mixtes : le dernier est la décimale", () => {
    expect(parseMoney("1.234,50", "EUR")).toBe(123450);
    expect(parseMoney("1,234.5", "USD")).toBe(123450);
  });

  it("groupements répétés", () => {
    expect(parseMoney("1.234.567", "MGA")).toBe(1234567);
  });

  it("MGA : « 1,500 » est un groupement de milliers", () => {
    expect(parseMoney("1,500", "MGA")).toBe(1500);
  });

  it("négatifs", () => {
    expect(parseMoney("-3", "MGA")).toBe(-3);
    expect(parseMoney(`${MINUS}12,30`, "EUR")).toBe(-1230);
  });

  it("refuse les décimales non admises plutôt que d’arrondir", () => {
    expect(parseMoney("12,5", "MGA")).toBeNull();
    expect(parseMoney("12,345", "EUR")).toBeNull();
    expect(parseMoney("1,500", "EUR")).toBeNull();
  });

  it("refuse les saisies invalides", () => {
    expect(parseMoney("", "EUR")).toBeNull();
    expect(parseMoney("abc", "EUR")).toBeNull();
    expect(parseMoney("12,", "EUR")).toBeNull();
    expect(parseMoney("-", "MGA")).toBeNull();
  });

  it("aller-retour format → parse", () => {
    for (const [amount, code] of [
      [0, "MGA"],
      [1234567, "MGA"],
      [-98765, "MGA"],
      [1250, "EUR"],
      [-5, "EUR"],
      [1234567, "USD"],
    ] as const) {
      expect(parseMoney(formatMoney(amount, code), code)).toBe(amount);
    }
  });
});

describe("roundedDivide (arrondi unique, moitiés vers l’infini)", () => {
  it("arrondit au plus proche", () => {
    expect(roundedDivide(7, 3)).toBe(2);
    expect(roundedDivide(8, 3)).toBe(3);
    expect(roundedDivide(4, 2)).toBe(2);
  });

  it("moitiés arrondies à l’opposé de zéro", () => {
    expect(roundedDivide(5, 2)).toBe(3);
    expect(roundedDivide(-5, 2)).toBe(-3);
    expect(roundedDivide(-7, 3)).toBe(-2);
  });

  it("division par zéro refusée", () => {
    expect(() => roundedDivide(1, 0)).toThrow(MoneyError);
  });
});

describe("sumMinor", () => {
  it("additionne des entiers signés", () => {
    expect(sumMinor([100, -250, 50])).toBe(-100);
    expect(sumMinor([])).toBe(0);
  });

  it("refuse un flottant dans la somme", () => {
    expect(() => sumMinor([100, 0.5])).toThrow(MoneyError);
  });
});
