/** Champs affichés en priorité pour résumer un enregistrement (ordre d'apparition). */
const SUMMARY_FIELDS = ["name", "title", "memo", "label", "type", "amount", "date", "blobName"] as const;

/**
 * Résumé lisible d'un enregistrement synchronisé, pour la consultation administrateur.
 * Les champs connus d'abord ; à défaut, le début du JSON. Les pièces jointes n'affichent que leur nom.
 */
export function summarizeRecord(data: Record<string, unknown> | null): string {
  if (!data) return "";
  const parts: string[] = [];
  for (const field of SUMMARY_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || value === "") continue;
    if (field === "blobName") continue;
    parts.push(`${field}: ${String(value)}`);
  }
  if (parts.length === 0) {
    if (typeof data.name === "string") return data.name;
    const json = JSON.stringify(data);
    return json.length > 160 ? `${json.slice(0, 160)}…` : json;
  }
  return parts.join(" · ");
}

