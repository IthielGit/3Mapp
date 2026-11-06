import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../src/lib/theme";
import "../../src/i18n";

const signOut = vi.fn(async () => undefined);
const accountState = vi.hoisted(() => ({ current: { status: "unconfigured" } as unknown }));

vi.mock("../../src/features/account/AccountProvider", () => ({
  useAccount: () => accountState.current,
}));
vi.mock("../../src/features/account/use-sign-out", () => ({
  useSignOut: () => ({ busy: false, signOut }),
}));

import { AccountMenu } from "../../src/components/AccountMenu";

function renderMenu() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/budgets"]}>
        <AccountMenu />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function signedIn(email = "ana@exemple.be") {
  accountState.current = { status: "signedIn", client: {}, session: { user: { id: "u1", email } } };
}

describe("menu du compte", () => {
  beforeEach(() => {
    signOut.mockClear();
  });

  it("sans session chargée, se réduit à l'engrenage vers Paramètres", () => {
    accountState.current = { status: "unconfigured" };
    renderMenu();
    const link = screen.getByRole("link", { name: "Paramètres" });
    expect(link.getAttribute("href")).toBe("/plus");
    expect(screen.queryByRole("button", { name: "Menu du compte" })).toBeNull();
  });

  it("affiche l'initiale de l'e-mail et ouvre un menu à trois entrées plus la déconnexion", () => {
    signedIn();
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Menu du compte" });
    expect(trigger.textContent).toBe("A");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Paramètres", "Compte", "Se déconnecter"]);
    expect(within(menu).getByText("ana@exemple.be")).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Compte" }).getAttribute("href")).toBe("/plus/account");
  });

  it("le premier élément reçoit le focus à l'ouverture, les flèches tournent dans le menu", () => {
    signedIn();
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }));
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("Échap ferme le menu et rend le focus au bouton", () => {
    signedIn();
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Menu du compte" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("la déconnexion passe par le même flux que la page Compte", () => {
    signedIn();
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
