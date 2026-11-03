/** Déclenche le téléchargement d'un fichier généré dans le navigateur. */
export function downloadBlob(content: Blob, filename: string): void {
  const url = URL.createObjectURL(content);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
