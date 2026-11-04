import { afterEach, describe, expect, it, vi } from "vitest";
import { canShareFiles, shareFile } from "../../src/lib/share";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("partage natif de la sauvegarde", () => {
  it("indisponible sans Web Share (ordinateur, jsdom) : le bouton n'est pas proposé", () => {
    expect(canShareFiles()).toBe(false);
  });

  it("partage le fichier avec son nom et retourne true", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    const ok = await shareFile(new Blob(["{}"], { type: "application/json" }), "backup.json");
    expect(ok).toBe(true);
    const payload = share.mock.calls[0]?.[0] as { files: File[] };
    expect(payload.files[0]?.name).toBe("backup.json");
    expect(payload.files[0]?.type).toBe("application/json");
  });

  it("feuille fermée par l'utilisateur : retourne false, sans erreur", async () => {
    const abort = new DOMException("annulé", "AbortError");
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(abort), canShare: () => true });
    expect(await shareFile(new Blob(["{}"]), "backup.json")).toBe(false);
  });

  it("autre erreur de partage : elle remonte", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new Error("refusé")),
      canShare: () => true,
    });
    await expect(shareFile(new Blob(["{}"]), "backup.json")).rejects.toThrow("refusé");
  });
});
