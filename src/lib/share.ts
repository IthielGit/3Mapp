/**
 * Partage natif d'un fichier (Web Share API) : le téléphone propose ses applications
 * (Google Drive, OneDrive, Dropbox, e-mail…). Gratuit, sans compte ni clé dans l'application.
 */

/** Vrai si le navigateur sait partager un fichier de ce type (Android Chrome, iOS Safari). */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    const probe = new File(["{}"], "probe.json", { type: "application/json" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Ouvre la feuille de partage. Retourne false si l'utilisateur l'a fermée sans partager. */
export async function shareFile(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: name });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    throw err;
  }
}
