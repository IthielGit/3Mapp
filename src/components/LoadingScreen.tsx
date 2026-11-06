import type { ReactNode } from "react";

interface LoadingScreenProps {
  /** Texte affiché sous l'animation (et annoncé aux lecteurs d'écran). */
  label: ReactNode;
}

/**
 * Écran de chargement plein écran : un arc en jauge qui tourne autour d'un point (repère visuel de l'app).
 * Sans mouvement si « réduire les animations » est activé : le texte reste la seule information.
 */
export function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-screen flex-col items-center justify-center gap-5 p-6"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="h-14 w-14 animate-spin motion-reduce:animate-none"
        fill="none"
      >
        <circle cx="24" cy="24" r="18" className="stroke-neutral-200 dark:stroke-white/15" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r="18"
          className="stroke-brand-600 dark:stroke-brand-dark"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="85 113"
        />
      </svg>
      <p className="text-neutral-600 dark:text-muted">{label}</p>
    </div>
  );
}
