import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccountAvatar } from "../../src/components/AccountAvatar";
import "../../src/i18n";

const accountState = vi.hoisted(() => ({ current: { status: "unconfigured" } as unknown }));

vi.mock("../../src/features/account/AccountProvider", () => ({
  useAccount: () => accountState.current,
}));

import { AccountPage } from "../../src/features/account/AccountPage";

const PHOTO = "https://lh3.googleusercontent.com/a/photo=s96-c";

describe("photo du compte", () => {
  it("affiche la photo quand il y en a une", () => {
    const { container } = render(<AccountAvatar avatarUrl={PHOTO} initial="H" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(PHOTO);
    expect(container.textContent).not.toContain("H");
  });

  it("revient à l'initiale si la photo ne charge pas", () => {
    const { container } = render(<AccountAvatar avatarUrl={PHOTO} initial="H" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("H");
  });

  it("sans photo, affiche l'initiale", () => {
    const { container } = render(<AccountAvatar initial="H" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("H");
  });

  it("la carte « Connecté en tant que » de la page Compte affiche la photo Google", () => {
    accountState.current = {
      status: "signedIn",
      client: {},
      session: {
        user: {
          id: "u1",
          email: "harinosy.tradeco@gmail.com",
          user_metadata: { full_name: "Ithiel", avatar_url: PHOTO },
        },
      },
    };
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    const card = screen.getByText("harinosy.tradeco@gmail.com").closest("div")?.parentElement;
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(PHOTO);
  });
});
