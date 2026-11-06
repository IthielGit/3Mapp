import type { KeyboardEvent } from "react";

/**
 * Groupe de choix (role="radio") : une seule étape de Tab, puis Flèches gauche/droite (et haut/bas)
 * pour changer d'option, comme un groupe radio natif. Le choix coché est l'élément à tabIndex 0.
 * À placer sur le conteneur role="radiogroup" : onKeyDown={onRadioGroupKeyDown}.
 */
export function onRadioGroupKeyDown(event: KeyboardEvent<HTMLElement>): void {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
  if (!forward && !backward) return;
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'));
  const index = radios.indexOf(document.activeElement as HTMLElement);
  if (index < 0 || radios.length === 0) return;
  event.preventDefault();
  const next = radios[(index + (forward ? 1 : -1) + radios.length) % radios.length];
  next?.focus();
  next?.click();
}
