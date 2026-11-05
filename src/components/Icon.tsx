import type { ReactNode } from "react";

/** Icônes de trait (même style que la barre basse) : une seule source pour toute l'interface. */
const PATHS: Record<string, ReactNode> = {
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 11V9a3 3 0 0 1 3-3h11" />
      <path d="M15 3l3 3-3 3" />
      <path d="M20 13v2a3 3 0 0 1-3 3H6" />
      <path d="M9 21l-3-3 3-3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  balance: (
    <>
      <path d="M12 4v16M5 20h14" />
      <path d="M4 7h16" />
      <path d="M7 7l-3 6h6z" />
      <path d="M17 7l-3 6h6z" />
    </>
  ),
  exchange: (
    <>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="M7 10l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  sparkle: <path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  swap: (
    <>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </>
  ),
  tune: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  donut: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 8 8h-8z" />
    </>
  ),
  bars: <path d="M5 20V12M12 20V5M19 20v-7" />,
  line: <path d="M4 17l5-5 4 3 7-8" />,
  inbox: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 13h5l1.5 2h5l1.5-2h5" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  reset: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />,
  equal: <path d="M5 9h14M5 15h14" />,
  percent: (
    <>
      <path d="M6 18L18 6" />
      <circle cx="7.5" cy="7.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
