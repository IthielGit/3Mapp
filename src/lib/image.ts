/**
 * Compresse une image côté client (SPEC §4 : ≤ 1280 px, JPEG). Le reste des fichiers est conservé tel quel.
 */
export async function compressImage(file: Blob, maxSide = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponible");
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression impossible"))),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
