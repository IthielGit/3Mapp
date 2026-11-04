import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Durée de sortie : la feuille reste montée le temps de glisser vers le bas. */
const EXIT_MS = 260;

/**
 * Feuille modale en bas d'écran. Entrée et sortie par glissement depuis le bord (la sortie suit
 * le chemin de l'entrée). Fermeture par Échap, par le fond, ou par le bouton ×.
 * Les mouvements disparaissent avec « prefers-reduced-motion » ; le fondu reste.
 */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const titleId = useId();
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  // Aucun setState de façon synchrone dans l'effet : tout passe par des minuteurs ou des images.
  useEffect(() => {
    if (open) {
      const mount = window.setTimeout(() => setPresent(true));
      // Deux images : la feuille doit d'abord exister hors écran, puis glisser.
      const frame = window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => setVisible(true)),
      );
      return () => {
        window.clearTimeout(mount);
        window.cancelAnimationFrame(frame);
      };
    }
    // Fermeture : la feuille glisse tout de suite (classes conditionnées par open), puis se démonte.
    const exit = window.setTimeout(() => {
      setPresent(false);
      setVisible(false);
    }, EXIT_MS);
    return () => window.clearTimeout(exit);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!present) return null;
  const shown = open && visible;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={title}
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ease-out ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition-transform duration-[320ms] ease-drawer motion-reduce:transform-none dark:bg-card ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-xl"
            aria-label="×"
          >
            ×
          </button>
        </header>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
