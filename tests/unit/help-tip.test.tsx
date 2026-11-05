import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HelpTip } from "../../src/components/HelpTip";

describe("HelpTip (aide contextuelle)", () => {
  it("ouvre une feuille avec l'explication au clic sur « ? »", async () => {
    render(
      <HelpTip
        title="Écart non détaillé"
        paragraphs={["Le solde est corrigé mais ne compte pas en revenu."]}
        steps={["Étape une"]}
      />,
    );
    expect(screen.queryByText("Le solde est corrigé mais ne compte pas en revenu.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Écart non détaillé/ }));
    // La feuille monte après un court délai (animation d'entrée).
    expect(await screen.findByText("Le solde est corrigé mais ne compte pas en revenu.")).toBeTruthy();
    expect(screen.getByText("Étape une")).toBeTruthy();
  });
});
