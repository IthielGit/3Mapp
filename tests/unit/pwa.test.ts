import { describe, expect, it, vi } from "vitest";
import {
  installState,
  installUpdate,
  isIos,
  listenForInstallPrompt,
  promptInstall,
  publishUpdate,
} from "../../src/lib/pwa";

function fakeWindow(options: { standalone?: boolean; userAgent?: string } = {}): Window {
  return {
    matchMedia: () => ({ matches: options.standalone ?? false }),
    navigator: { userAgent: options.userAgent ?? "Mozilla/5.0 (X11; Linux x86_64)" },
  } as unknown as Window;
}

describe("installation de l'application", () => {
  it("détecte iPhone et iPad (pas d'invite automatique, marche à suivre)", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });

  it("état « installée » quand l'app tourne en mode autonome", () => {
    expect(installState(fakeWindow({ standalone: true }))).toBe("installed");
  });

  it("sur iPhone sans invite : état « ios »", () => {
    const win = fakeWindow({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    expect(installState(win)).toBe("ios");
  });

  it("sur ordinateur sans invite : aucune carte d'installation", () => {
    expect(installState(fakeWindow())).toBe("unavailable");
  });

  it("invite du navigateur mémorisée puis utilisée ; refus de l'utilisateur géré", async () => {
    const target = new EventTarget() as unknown as Window;
    listenForInstallPrompt(target);

    const accepted = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: accepted,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    target.dispatchEvent(event);

    expect(installState(fakeWindow())).toBe("available");
    expect(await promptInstall()).toBe(true);
    expect(accepted).toHaveBeenCalledOnce();
    expect(installState(fakeWindow())).toBe("unavailable");
  });
});

describe("mise à jour du service worker", () => {
  it("installUpdate applique la mise à jour publiée", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    publishUpdate(apply);
    await installUpdate();
    expect(apply).toHaveBeenCalledOnce();
  });
});
