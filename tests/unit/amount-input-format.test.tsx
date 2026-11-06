import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AmountInput } from "../../src/components/AmountInput";
import { setAmountFormat } from "../../src/lib/money";

afterEach(() => {
  cleanup();
  setAmountFormat(undefined);
});

describe("Saisie du montant : affichage selon le format", () => {
  it("affiche les milliers pendant la saisie (format par points)", () => {
    render(<AmountInput expression="1500000" onExpressionChange={vi.fn()} currency="MGA" label="Montant" />);
    expect((screen.getByLabelText("Montant") as HTMLInputElement).value).toBe("1.500.000");
  });

  it("suit le réglage de format de l'app", () => {
    setAmountFormat("comma");
    render(<AmountInput expression="1500,5" onExpressionChange={vi.fn()} currency="EUR" label="Montant" />);
    expect((screen.getByLabelText("Montant") as HTMLInputElement).value).toBe("1,500.5");
  });

  it("une saisie au clavier est reformatée, l'expression reste brute", () => {
    const onExpressionChange = vi.fn();
    render(<AmountInput expression="1500" onExpressionChange={onExpressionChange} currency="MGA" label="Montant" />);
    const input = screen.getByLabelText("Montant") as HTMLInputElement;
    // L'utilisateur tape 0 en fin de « 1.500 » : le champ affiche « 1.5000 ».
    fireEvent.change(input, { target: { value: "1.5000" } });
    expect(onExpressionChange).toHaveBeenCalledWith("15000");
  });

  it("une touche du pavé ajoute le chiffre à l'expression brute", () => {
    const onExpressionChange = vi.fn();
    render(<AmountInput expression="1500" onExpressionChange={onExpressionChange} currency="MGA" label="Montant" />);
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onExpressionChange).toHaveBeenCalledWith("15005");
  });
});
