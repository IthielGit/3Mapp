import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function snapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/** Réseau disponible d'après le navigateur, mis à jour aux événements online/offline. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
