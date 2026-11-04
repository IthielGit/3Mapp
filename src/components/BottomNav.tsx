import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

type IconName = "home" | "list" | "chart" | "wallet" | "settings";

/** Pictogrammes en trait, sans bibliothèque. L'état actif s'exprime par la couleur et le trait. */
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
          <path d="M3 10h18M16 14.5h2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </svg>
      );
  }
}

const ITEMS: { to: string; key: string; icon: IconName; end?: boolean }[] = [
  { to: "/", key: "nav.home", icon: "home", end: true },
  { to: "/transactions", key: "nav.transactions", icon: "list" },
  { to: "/stats", key: "nav.stats", icon: "chart" },
  { to: "/budgets", key: "nav.budgets", icon: "wallet" },
  { to: "/plus", key: "nav.more", icon: "settings" },
];

/**
 * Barre basse en thème clair : fond blanc, cinq destinations régulièrement espacées.
 * L'ajout rapide est un bouton rouge flottant au-dessus de la barre.
 */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <>
      <nav
        aria-label={t("nav.home")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-card"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  `flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] transition-colors ${
                    isActive
                      ? "font-semibold text-accent"
                      : "font-medium text-slate-500 dark:text-muted"
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
      <Link
        to="/transactions/new"
        aria-label={t("nav.quickAdd")}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl leading-none text-white shadow-lg transition-transform duration-150 ease-out-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true">+</span>
      </Link>
    </>
  );
}
