import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../src/lib/theme";
import "../../src/i18n";

vi.mock("../../src/features/account/AccountProvider", () => ({
  useAccount: () => ({ status: "signedIn", client: {}, session: { user: { id: "u1", email: "ana@exemple.be" } } }),
}));
vi.mock("../../src/features/account/use-sign-out", () => ({
  useSignOut: () => ({ busy: false, signOut: vi.fn() }),
}));

import { AccountMenu } from "../../src/components/AccountMenu";

describe("menu du compte : thème", () => {
  it("propose Système, Clair et Sombre, avec le choix actif coché", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AccountMenu />
        </MemoryRouter>
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }));
    const menu = screen.getByRole("menu");
    const radios = within(menu).getAllByRole("menuitemradio");
    // Les choix de thème sont des icônes : leur nom accessible porte le libellé.
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["Système", "Clair", "Sombre"]);
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(radios[2] as HTMLElement);
    const after = within(screen.getByRole("menu")).getAllByRole("menuitemradio");
    expect(after[2]?.getAttribute("aria-checked")).toBe("true");
    expect(after[0]?.getAttribute("aria-checked")).toBe("false");
  });
});
