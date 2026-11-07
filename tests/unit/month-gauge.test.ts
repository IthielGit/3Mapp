import { describe, expect, it } from "vitest";
import { gaugeGeometry, keptPercent, remainingShare } from "../../src/domain/month-gauge";

describe("keptPercent", () => {
  it("arrondit la part gardée en pourcentage", () => {
    expect(keptPercent(1_000_000, 320_011)).toBe(68);
  });

  it("vaut 0 quand on a dépensé plus que reçu", () => {
    expect(keptPercent(1_000_000, 1_200_000)).toBe(0);
  });

  it("sans revenu : null", () => {
    expect(keptPercent(0, 0)).toBeNull();
  });
});

describe("remainingShare", () => {
  it("donne la part du revenu qui reste", () => {
    expect(remainingShare(1_000_000, 250_000)).toBe(0.75);
  });

  it("borne à 0 quand on a dépensé plus que reçu", () => {
    expect(remainingShare(1_000_000, 1_500_000)).toBe(0);
  });

  it("borne à 1 quand rien n'a été dépensé", () => {
    expect(remainingShare(1_000_000, 0)).toBe(1);
  });

  it("sans revenu, la jauge est vide", () => {
    expect(remainingShare(0, 0)).toBe(0);
    expect(remainingShare(0, 500)).toBe(0);
  });
});

describe("gaugeGeometry", () => {
  it("sans part restante : pas de remplissage ni de point", () => {
    const g = gaugeGeometry(0);
    expect(g.fill).toBeNull();
    expect(g.dot).toBeNull();
    expect(g.track).toMatch(/^M /);
  });

  it("part pleine : le point est à 45° (en bas à droite)", () => {
    const g = gaugeGeometry(1);
    expect(g.dot).not.toBeNull();
    expect(g.dot?.x).toBeCloseTo(38.14, 2);
    expect(g.dot?.y).toBeCloseTo(38.14, 2);
  });

  it("valeurs hors bornes sont ramenées dans [0, 1]", () => {
    expect(gaugeGeometry(2).dot).toEqual(gaugeGeometry(1).dot);
    expect(gaugeGeometry(-1).fill).toBeNull();
  });

  it("un arc partiel utilise le grand arc au-delà de la moitié", () => {
    expect(gaugeGeometry(0.25).fill).toContain(" 0 0 1 ");
    expect(gaugeGeometry(0.75).fill).toContain(" 0 1 1 ");
  });
});
