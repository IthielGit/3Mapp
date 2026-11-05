import { useId } from "react";

/**
 * Repère de la marque : une jauge à 270° avec un point au bout (le budget restant).
 * Même dessin que l'icône de l'application (public/icons/icon.svg), en version sombre.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  // useId renvoie des deux-points, peu sûrs dans url(#…) : on les retire.
  const gradientId = `brandmark-${useId().replace(/:/g, "")}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x2="0.8" y2="1">
          <stop stopColor="#1F2937" />
          <stop offset="1" stopColor="#0B1220" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="7" />
      <path d="M32 12 A20 20 0 1 1 12 32" fill="none" stroke="#F4F6F7" strokeWidth="7" strokeLinecap="round" />
      <circle cx="12" cy="32" r="6" fill="#10B0DC" stroke="#0B1220" strokeWidth="2.5" />
    </svg>
  );
}
