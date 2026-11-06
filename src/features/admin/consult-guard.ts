import { READ_ONLY_BLOCKED_EVENT } from "../../db/sync-tracking";

/**
 * Pendant une consultation, les contrôles qui modifient les données sont désactivés à l'écran :
 * grisés, et toute tentative est bloquée et signalée. Les liens de navigation restent utilisables, ainsi que
 * les éléments marqués `data-consult-allow` (bannière, retour à son propre compte).
 *
 * Ceci vient en complément de la garde de la base locale (sync-tracking.ts), qui reste la protection réelle.
 * Les listeners sont en phase de capture sur `document` : ils couvrent aussi les feuilles et fenêtres
 * rendues hors de l'arbre principal (portails).
 */

const ALLOW_SELECTOR = "[data-consult-allow]";
const CONTROL_SELECTOR =
  "button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=option], [role=menuitem]";
const STYLE_ID = "consult-guard-style";

function isAllowed(target: Element): boolean {
  return target.closest(ALLOW_SELECTOR) !== null;
}

function controlOf(target: EventTarget | null): Element | undefined {
  if (!(target instanceof Element)) return undefined;
  if (isAllowed(target)) return undefined;
  return target.closest(CONTROL_SELECTOR) ?? undefined;
}

function signalBlocked(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  window.dispatchEvent(new Event(READ_ONLY_BLOCKED_EVENT));
}

/** Active le mode lecture seule à l'écran. Renvoie la fonction qui le désactive. */
export function installConsultGuard(): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    body[data-consult="true"] :is(button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio]):not([data-consult-allow], [data-consult-allow] *) {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `;
  document.head.appendChild(style);
  document.body.dataset.consult = "true";

  const onClick = (event: MouseEvent) => {
    if (controlOf(event.target)) signalBlocked(event);
  };
  const onSubmit = (event: Event) => {
    const form = event.target;
    if (form instanceof Element && isAllowed(form)) return;
    signalBlocked(event);
  };
  const onBeforeInput = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || isAllowed(target)) return;
    if (target.matches("input, textarea, [contenteditable=true]")) signalBlocked(event);
  };
  const onMouseDown = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof Element && !isAllowed(target) && target.closest("select")) signalBlocked(event);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || isAllowed(target)) return;
    // Les touches de navigation restent libres ; une saisie ou un choix dans une liste est bloqué.
    const navigation = ["Tab", "Shift", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Control", "Meta", "Alt"];
    if (target.closest("select") && !navigation.includes(event.key)) signalBlocked(event);
    if (target.matches("button, [role=button]") && (event.key === "Enter" || event.key === " ")) signalBlocked(event);
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("beforeinput", onBeforeInput, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("submit", onSubmit, true);
    document.removeEventListener("beforeinput", onBeforeInput, true);
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    delete document.body.dataset.consult;
    document.getElementById(STYLE_ID)?.remove();
  };
}
