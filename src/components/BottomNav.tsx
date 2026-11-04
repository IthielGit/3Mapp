import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** Cinq onglets de largeur égale. Le bouton d'ajout rapide flotte au-dessus de la barre. */
const ITEMS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/transactions", key: "nav.transactions" },
  { to: "/budgets", key: "nav.budgets" },
  { to: "/stats", key: "nav.stats" },
  { to: "/plus", key: "nav.more" },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <>
      <nav
        aria-label={t("nav.home")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={"end" in item ? item.end : false}
                className={({ isActive }) =>
                  `flex min-h-[56px] items-center justify-center px-1 text-center text-xs font-medium transition-colors ${
                    isActive
                      ? "text-brand-700 dark:text-brand-300"
                      : "text-slate-600 dark:text-slate-400"
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Link
        to="/transactions/new"
        aria-label={t("nav.quickAdd")}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-3xl leading-none text-white shadow-lg transition-transform duration-150 ease-out-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        <span aria-hidden="true">+</span>
      </Link>
    </>
  );
}
