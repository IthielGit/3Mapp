import { createContext } from "react";

/**
 * Emplacements de la ligne d'en-tête (bouton retour + titre + actions) fournie par AppLayout.
 * Le titre de chaque écran se place dans cette ligne, à la même hauteur que le bouton retour.
 */
export interface HeaderSlots {
  titleSlot: HTMLElement | null;
  actionsSlot: HTMLElement | null;
}

export const HeaderSlotsContext = createContext<HeaderSlots>({
  titleSlot: null,
  actionsSlot: null,
});
