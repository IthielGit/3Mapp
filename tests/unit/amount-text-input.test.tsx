import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AmountTextInput } from "../../src/components/AmountTextInput";
import { parseAmountText, sanitizeAmountDisplay } from "../../src/lib/amount-entry";
import { setAmountFormat } from "../../src/lib/money";

function Controlled({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <AmountTextInput aria-label="montant" value={value} onValueChange={setValue} />;
}

describe("sanitizeAmountDisplay", () => {
  beforeEach(() => setAmountFormat("dot"));
  afterEach(() => setAmountFormat(undefined));

  it("retire les lettres et garde la décimale du format", () => {
    expect(sanitizeAmountDisplay("12a,5", 4, false)).toEqual({ text: "12,5", cursor: 3 });
  });

  it("garde le séparateur de milliers du format (il est retiré ensuite par rawFromDisplay)", () => {
    expect(sanitizeAmountDisplay("1.2", 3, false)).toEqual({ text: "1.2", cursor: 3 });
  });

  it("n'accepte qu'une décimale hors expression", () => {
    expect(sanitizeAmountDisplay("12,3,4", 6, false)).toEqual({ text: "12,34", cursor: 5 });
    expect(sanitizeAmountDisplay("1,5+2,5", 7, true).text).toBe("1,5+2,5");
  });

  it("garde les opérateurs seulement si demandé", () => {
    expect(sanitizeAmountDisplay("10+5", 4, false).text).toBe("105");
    expect(sanitizeAmountDisplay("10+5", 4, true).text).toBe("10+5");
  });
});

describe("parseAmountText", () => {
  beforeEach(() => setAmountFormat("dot"));
  afterEach(() => setAmountFormat(undefined));

  it("lit un montant formaté avec des points (MGA)", () => {
    expect(parseAmountText("1.500.000", "MGA")).toBe(1500000);
  });

  it("lit une décimale en format « points » (EUR)", () => {
    expect(parseAmountText("1.234,5", "EUR")).toBe(123450);
  });

  it("lit un montant en format « virgules »", () => {
    setAmountFormat("comma");
    expect(parseAmountText("1,234.5", "EUR")).toBe(123450);
  });

  it("renvoie null pour un champ vide ou invalide", () => {
    expect(parseAmountText("", "MGA")).toBeNull();
    expect(parseAmountText("12,345", "EUR")).toBeNull();
  });
});

describe("AmountTextInput", () => {
  beforeEach(() => setAmountFormat("dot"));
  afterEach(() => setAmountFormat(undefined));

  it("se reformate pendant la frappe", () => {
    render(<Controlled />);
    const input = screen.getByLabelText("montant") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1500000" } });
    expect(input.value).toBe("1.500.000");
  });

  it("garde le texte formaté quand on continue à taper", () => {
    render(<Controlled initial="1.500" />);
    const input = screen.getByLabelText("montant") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.5003" } });
    expect(input.value).toBe("15.003");
  });

  it("appelle onValueChange avec le texte formaté", () => {
    const seen: string[] = [];
    render(<AmountTextInput aria-label="montant" defaultValue="" onValueChange={(v) => seen.push(v)} />);
    const input = screen.getByLabelText("montant") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "250000" } });
    expect(seen).toEqual(["250.000"]);
    expect(input.value).toBe("250.000");
  });
});
