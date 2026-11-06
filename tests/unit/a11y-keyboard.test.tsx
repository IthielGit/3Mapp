import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AmountInput } from "../../src/components/AmountInput";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Announcer } from "../../src/components/Announcer";
import { announce } from "../../src/components/announce";
import { onRadioGroupKeyDown } from "../../src/components/radio-keys";

describe("Montant au clavier", () => {
  it("accepte les chiffres et convertit le point en virgule", () => {
    const onExpressionChange = vi.fn();
    render(
      <AmountInput expression="" onExpressionChange={onExpressionChange} currency="MGA" label="Montant" />,
    );
    const input = screen.getByLabelText("Montant");
    // Un chiffre n'est pas bloqué : le champ le prend tel quel.
    expect(fireEvent.keyDown(input, { key: "5" })).toBe(true);
    // Le point devient une virgule (séparateur décimal de la calculatrice).
    fireEvent.keyDown(input, { key: "." });
    expect(onExpressionChange).toHaveBeenCalledWith(",");
  });

  it("bloque les lettres qui ne sont pas des opérateurs", () => {
    render(<AmountInput expression="" onExpressionChange={vi.fn()} currency="MGA" label="Montant" />);
    expect(fireEvent.keyDown(screen.getByLabelText("Montant"), { key: "a" })).toBe(false);
  });

  it("Entrée calcule l'expression puis confirme", () => {
    const onExpressionChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AmountInput
        expression="5+3"
        onExpressionChange={onExpressionChange}
        currency="MGA"
        label="Montant"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Montant"), { key: "Enter" });
    expect(onExpressionChange).toHaveBeenCalledWith("8");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Entrée sans opération confirme sans toucher au montant", () => {
    const onExpressionChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AmountInput
        expression="1200"
        onExpressionChange={onExpressionChange}
        currency="MGA"
        label="Montant"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Montant"), { key: "Enter" });
    expect(onExpressionChange).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("prend le focus à l'ouverture du pavé", () => {
    render(<AmountInput expression="" onExpressionChange={vi.fn()} currency="MGA" label="Montant" />);
    expect(document.activeElement).toBe(screen.getByLabelText("Montant"));
  });
});

function SheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Nouvelle transaction
      </button>
      <BottomSheet open={open} title="Titre" onClose={() => setOpen(false)}>
        <p>Contenu</p>
      </BottomSheet>
    </>
  );
}

describe("Feuille modale : focus", () => {
  it("entre dans la feuille à l'ouverture et revient au bouton à la fermeture", async () => {
    render(<SheetHarness />);
    const trigger = screen.getByRole("button", { name: "Nouvelle transaction" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("dialog")));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger), { timeout: 1000 });
  });
});

describe("Groupe de choix : flèches", () => {
  function Group() {
    const [value, setValue] = useState("a");
    return (
      <div role="radiogroup" aria-label="Période" onKeyDown={onRadioGroupKeyDown}>
        {["a", "b", "c"].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            tabIndex={value === v ? 0 : -1}
            onClick={() => setValue(v)}
          >
            {v}
          </button>
        ))}
      </div>
    );
  }

  it("une seule étape de Tab, et les flèches déplacent la sélection", () => {
    render(<Group />);
    const [a, b, c] = screen.getAllByRole("radio");
    expect(a?.getAttribute("tabindex")).toBe("0");
    expect(b?.getAttribute("tabindex")).toBe("-1");
    expect(c?.getAttribute("tabindex")).toBe("-1");

    a?.focus();
    fireEvent.keyDown(a as HTMLElement, { key: "ArrowRight" });
    expect(b?.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(b);

    fireEvent.keyDown(b as HTMLElement, { key: "ArrowLeft" });
    expect(a?.getAttribute("aria-checked")).toBe("true");
  });
});

describe("Annonces", () => {
  it("lit les messages polis et les erreurs", async () => {
    render(<Announcer />);
    act(() => announce("Enregistré."));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Enregistré."));
    act(() => announce("Erreur réseau.", "assertive"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Erreur réseau."));
  });
});
