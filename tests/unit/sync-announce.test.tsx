import { act, render, screen, waitFor, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Announcer } from "../../src/components/Announcer";
import { useSyncStatus } from "../../src/features/sync/useSyncStatus";

/** Résultat de la prochaine synchro manuelle simulée : undefined = réussite, sinon l'erreur levée. */
let nextFailure: Error | undefined;

vi.mock("../../src/features/sync/sync-engine", () => {
  class SyncError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    SyncError,
    ensureSync: async () => {
      if (nextFailure) throw nextFailure;
    },
  };
});

vi.mock("../../src/features/account/AccountProvider", () => ({
  useAccount: () => ({
    status: "signedIn",
    client: {},
    session: { user: { id: "user-1" } },
  }),
}));

describe("Synchro manuelle : annonces", () => {
  it("annonce la fin d'une synchro demandée", async () => {
    nextFailure = undefined;
    render(<Announcer />);
    const { result } = renderHook(() => useSyncStatus());
    await act(async () => {
      await result.current.syncNow();
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Synchronisation terminée."));
  });

  it("annonce l'erreur de façon assertive", async () => {
    nextFailure = new Error("network");
    render(<Announcer />);
    const { result } = renderHook(() => useSyncStatus());
    await act(async () => {
      await result.current.syncNow();
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("La synchronisation a échoué."),
    );
  });
});
