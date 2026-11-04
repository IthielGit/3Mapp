import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

type IconName = "home" | "list" | "calendar" | "chart";

/** Pictogrammes en trait : l'état actif s'exprime par la couleur et l'épaisseur du trait. */
function NavIcon({ name, active }: { name: IconName; active: boolean }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-6 w-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: active ? 2.4 : 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 9 9h-9z" />
          <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
        </svg>
      );
  }
}

const LEFT = [
  { to: "/", key: "nav.home", icon: "home" as const, end: true },
  { to: "/transactions", key: "nav.transactions", icon: "list" as const },
];
const RIGHT = [
  { to: "/calendar", key: "nav.calendar", icon: "calendar" as const },
  { to: "/stats", key: "nav.stats", icon: "chart" as const },
];

const TAB =
  "flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] transition-colors";

/**
 * Barre basse : Accueil, Transactions, « + » au centre (ajout rapide), Calendrier, Analyses.
 * Les réglages sont dans l'en-tête de l'accueil.
 */
export function BottomNav() {
  const { t } = useTranslation();

  function tab(item: { to: string; key: string; icon: IconName; end?: boolean }) {
    return (
      <NavLink
        to={item.to}
        end={item.end ?? false}
        className={({ isActive }) =>
          `${TAB} ${isActive ? "font-semibold text-accent" : "font-medium text-slate-500 dark:text-muted"}`
        }
      >
        {({ isActive }) => (
          <>
            <NavIcon name={item.icon} active={isActive} />
            <span>{t(item.key)}</span>
          </>
        )}
      </NavLink>
    );
  }

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-card"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-center">
        {LEFT.map((item) => (
          <li key={item.to}>{tab(item)}</li>
        ))}
        <li className="flex justify-center">
          <Link
            to="/transactions/new"
            aria-label={t("nav.quickAdd")}
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl leading-none text-white shadow-lg ring-4 ring-white transition-transform duration-150 ease-out-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:ring-card"
          >
            <span aria-hidden="true">+</span>
          </Link>
        </li>
        {RIGHT.map((item) => (
          <li key={item.to}>{tab(item)}</li>
        ))}
      </ul>
    </nav>
  );
}
