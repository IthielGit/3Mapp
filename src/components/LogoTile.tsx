/**
 * Tuile du logo : repère en jauge (arc et point cyan) sur fond charbon, variante sombre de la charte.
 * Partagée par l'écran de connexion et l'onboarding pour qu'il n'y ait qu'une seule accroche visuelle.
 */
export function LogoTile() {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[linear-gradient(160deg,#1F2937,#0B1220)] shadow-md shadow-[#0B1220]/25">
      <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 12 A20 20 0 1 1 12 32" fill="none" stroke="#F4F6F7" strokeWidth="6" strokeLinecap="round" />
        <circle cx="12" cy="32" r="4.5" fill="#10B0DC" stroke="#0B1220" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
