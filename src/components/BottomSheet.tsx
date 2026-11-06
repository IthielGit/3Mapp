import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pied fixe (ex. bouton Enregistrer) : reste en bas de la feuille, hors de la zone qui défile. */
  footer?: ReactNode;
  /** Actions secondaires (ex. menu « ⋯ ») placées dans l'en-tête, à gauche du bouton de fermeture. */
  actions?: ReactNode;
}

/** Durée de sortie : la feuille reste montée le temps de glisser vers le bas. */
const EXIT_MS = 320;

/**
 * Feuille modale en bas d'écran. Entrée et sortie par glissement depuis le bord (la sortie suit
 * le chemin de l'entrée). Fermeture par Échap, par le fond, ou par le bouton ×.
 * Les mouvements disparaissent avec « prefers-reduced-motion » ; le fondu reste.
 */
export function BottomSheet({ open, title, onClose, children, footer, actions }: BottomSheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Élément qui avait le focus avant l'ouverture (bouton « Nouvelle transaction », etc.) : on y revient à la fermeture.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Aucun setState de façon synchrone dans l'effet : tout passe par des minuteurs ou des images.
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      const back = returnFocusRef.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    }, EXIT_MS);
    return () => window.clearTimeout(exit);
  }, [open]);

  // Le focus entre dans la feuille dès qu'elle est présente : Tab reste à l'intérieur, Échap ferme.
  useEffect(() => {
    if (open && present) panelRef.current?.focus({ preventScroll: true });
  }, [open, present]);

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
        className={`absolute inset-0 bg-neutral-900/50 transition-opacity duration-200 ease-out ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition-transform duration-[320ms] ease-drawer motion-reduce:transform-none dark:bg-card ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-white/15">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xl"
              aria-label={t("common.close")}
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-neutral-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/15 dark:bg-card">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
