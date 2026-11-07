import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/i18n";
import { Announcer } from "../../src/components/Announcer";
import { SyncStatusLine } from "../../src/features/sync/SyncStatusLine";

vi.mock("../../src/features/sync/sync-engine", () => {
  class SyncError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { SyncError, ensureSync: async () => undefined };
});

vi.mock("../../src/features/account/AccountProvider", () => ({
  useAccount: () => ({
    status: "signedIn",
    client: {},
    session: { user: { id: "user-1" } },
  }),
}));

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ligne d'état de l'accueil", () => {
  it("affiche « À jour », puis le passage hors ligne en texte et l'annonce", async () => {
    render(
      <>
        <Announcer />
        <SyncStatusLine />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId("sync-status").textContent).toBe("À jour"));

    act(() => setOnline(false));
    await waitFor(() =>
      expect(screen.getByTestId("sync-status").textContent).toBe("Hors ligne · enregistré sur cet appareil"),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Hors ligne. Vos modifications restent enregistrées sur cet appareil.",
      ),
    );
  });
});
