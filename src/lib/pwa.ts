import { useEffect, useState } from "react";

/**
 * État PWA partagé : mise à jour du service worker et installation de l'application (SPEC §5.17).
 * Fonctions pures sur l'état de la fenêtre, testables sans navigateur réel.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ---- Mise à jour du service worker -------------------------------------------------------

type ApplyUpdate = () => Promise<void>;

let applyUpdate: ApplyUpdate | undefined;
const updateListeners = new Set<() => void>();

/** Appelé par main.tsx quand une nouvelle version attend (registerType « prompt »). */
export function publishUpdate(apply: ApplyUpdate): void {
  applyUpdate = apply;
  updateListeners.forEach((listener) => listener());
}

/** Lance la mise à jour : le service worker prend le contrôle puis la page se recharge. */
export async function installUpdate(): Promise<void> {
  if (applyUpdate) await applyUpdate();
}

export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(applyUpdate !== undefined);
  useEffect(() => {
    const listener = () => setAvailable(true);
    updateListeners.add(listener);
    return () => {
      updateListeners.delete(listener);
    };
  }, []);
  return available;
}

// ---- Installation de l'application ------------------------------------------------------

let deferredInstall: BeforeInstallPromptEvent | undefined;
const installListeners = new Set<() => void>();

/** À appeler une fois au démarrage : mémorise l'invite d'installation du navigateur. */
export function listenForInstallPrompt(target: Window = window): void {
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener());
  });
  target.addEventListener("appinstalled", () => {
    deferredInstall = undefined;
    installListeners.forEach((listener) => listener());
  });
}

/** Déclenche la fenêtre d'installation native. Retourne true si l'utilisateur accepte. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstall) return false;
  const event = deferredInstall;
  await event.prompt();
  const choice = await event.userChoice;
  deferredInstall = undefined;
  installListeners.forEach((listener) => listener());
  return choice.outcome === "accepted";
}

export function isStandalone(win: Window = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return win.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** iPhone et iPad : pas d'invite automatique, l'installation passe par le menu Partager. */
export function isIos(userAgent: string = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/.test(userAgent);
}

export type InstallState = "installed" | "available" | "ios" | "unavailable";

export function installState(win: Window = window): InstallState {
  if (isStandalone(win)) return "installed";
  if (deferredInstall) return "available";
  if (isIos(win.navigator.userAgent)) return "ios";
  return "unavailable";
}

export function useInstallState(): InstallState {
  const [state, setState] = useState<InstallState>(() => installState());
  useEffect(() => {
    const listener = () => setState(installState());
    installListeners.add(listener);
    return () => {
      installListeners.delete(listener);
    };
  }, []);
  return state;
}
