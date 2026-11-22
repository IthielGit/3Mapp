import { useCallback, useRef, type MouseEvent, type PointerEvent } from "react";

/** Durée de maintien avant d'ouvrir le menu, et déplacement toléré (px) avant d'y renoncer (défilement). */
const HOLD_MS = 450;
const MOVE_TOLERANCE = 10;

/**
 * Appui long sur un élément (téléphone : maintenir ; souris : clic droit). Retourne les props à
 * étaler sur l'élément. Le clic qui suit un appui long est annulé, pour ne pas ouvrir la fiche
 * en plus du menu. Le défilement et le glissement annulent le maintien.
 */
export interface LongPressProps {
  onPointerDown?: (e: PointerEvent) => void;
  onPointerMove?: (e: PointerEvent) => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
  onPointerLeave?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
}

export function useLongPress(onLongPress: (() => void) | undefined): LongPressProps {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  }, []);

  const fire = useCallback(() => {
    clear();
    fired.current = true;
    onLongPress?.();
  }, [clear, onLongPress]);

  if (!onLongPress) return {};

  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(fire, HOLD_MS);
    },
    onPointerMove(e: PointerEvent) {
      const origin = start.current;
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_TOLERANCE) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // Sur Android, le maintien déclenche aussi le menu contextuel du navigateur : on le remplace.
    onContextMenu(e: MouseEvent) {
      e.preventDefault();
      if (!fired.current) fire();
    },
    onClick(e: MouseEvent) {
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
