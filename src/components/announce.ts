/** Ton d'annonce : « polite » attend la fin de la lecture en cours ; « assertive » l'interrompt (erreurs). */
export type AnnounceTone = "polite" | "assertive";

const EVENT = "fundora:announce";

/**
 * Annonce un message aux lecteurs d'écran (enregistrement, suppression, synchronisation, erreur).
 * Sans effet visuel : le message est lu par la zone live montée dans `Announcer`.
 */
export function announce(message: string, tone: AnnounceTone = "polite"): void {
  window.dispatchEvent(
    new CustomEvent<{ message: string; tone: AnnounceTone }>(EVENT, { detail: { message, tone } }),
  );
}

export const ANNOUNCE_EVENT = EVENT;
