import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

type IconName = "home" | "list" | "calendar" | "chart" | "wallet" | "user";

/** Pictogrammes en trait : l'état actif s'exprime par la couleur et l'épaisseur du trait. */
export function NavIcon({ name, active }: { name: IconName; active: boolean }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-6 w-6 shrink-0",
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
    case "wallet":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="M3 10h18M16.5 14.5h.01" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="4" />
          <path d="M4 20.5c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
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

/** Écran large : mêmes entrées, dans une colonne latérale avec libellés complets. */
const SIDE = [
  { to: "/", key: "nav.home", icon: "home" as const, end: true },
  { to: "/transactions", key: "nav.transactions", icon: "list" as const },
  { to: "/calendar", key: "nav.calendar", icon: "calendar" as const },
  { to: "/stats", key: "nav.stats", icon: "chart" as const },
  { to: "/plus/wallets", key: "more.wallets", icon: "wallet" as const },
  { to: "/plus", key: "pages.more.title", icon: "user" as const },
];

const TAB =
  "flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] transition-colors";

/**
 * Barre basse (téléphone) : Accueil, Transactions, « + » au centre (ajout rapide), Calendrier, Analyses.
 * Masquée sur grand écran, remplacée par la colonne latérale.
 */
export function BottomNav() {
  const { t } = useTranslation();

  function tab(item: { to: string; key: string; icon: IconName; end?: boolean }) {
    return (
      <NavLink
        to={item.to}
        end={item.end ?? false}
        className={({ isActive }) =>
          `${TAB} ${isActive ? "font-semibold text-brand-700 dark:text-brand-300" : "font-medium text-slate-500 dark:text-muted"}`
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-white/15 dark:bg-card"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_3.5rem_1fr_1fr] items-center">
        {LEFT.map((item) => (
          <li key={item.to}>{tab(item)}</li>
        ))}
        <li className="flex flex-col items-center justify-end pb-1">
          <Link
            to="/transactions/new"
            aria-label={t("nav.quickAdd")}
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-3xl leading-none text-white shadow-lg ring-4 ring-white transition-transform duration-150 ease-out-strong active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:ring-card"
          >
            <span aria-hidden="true">+</span>
          </Link>
          <span aria-hidden="true" className="mt-1 text-[11px] font-medium text-slate-500 dark:text-muted">
            {t("nav.add")}
          </span>
        </li>
        {RIGHT.map((item) => (
          <li key={item.to}>{tab(item)}</li>
        ))}
      </ul>
    </nav>
  );
}

/** Colonne latérale sur grand écran (au-delà de 768 px). Masquée sur téléphone. */
export function SideNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.main")}
      className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-slate-200 md:bg-white md:px-3 md:py-6 dark:md:border-white/15 dark:md:bg-card"
    >
      <Link
        to="/transactions/new"
        className="mb-4 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white transition-transform duration-150 ease-out-strong active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          +
        </span>
        {t("nav.quickAdd")}
      </Link>
      <ul className="flex flex-col gap-1">
        {SIDE.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 transition-colors ${
                  isActive
                    ? "bg-brand-700/10 font-semibold text-brand-700 dark:text-brand-300"
                    : "font-medium text-slate-600 hover:bg-slate-100 dark:text-muted dark:hover:bg-raised"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon name={item.icon} active={isActive} />
                  <span>{t(item.key)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
