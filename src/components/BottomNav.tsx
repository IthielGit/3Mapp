import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Barre basse : deux onglets, un bouton « + » central (ajout rapide), trois onglets.
 * Les libellés accessibles restent stables : les tests et les lecteurs d'écran s'y fient.
 */
const LEFT = [
  { to: "/", key: "nav.home", end: true },
  { to: "/transactions", key: "nav.transactions" },
] as const;

const RIGHT = [
  { to: "/budgets", key: "nav.budgets" },
  { to: "/stats", key: "nav.stats" },
  { to: "/plus", key: "nav.more" },
] as const;

const TAB =
  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-xs transition-colors";

export function BottomNav() {
  const { t } = useTranslation();

  function tab(item: { to: string; key: string; end?: boolean }) {
    return (
      <NavLink
        to={item.to}
        end={item.end ?? false}
        className={({ isActive }) =>
          `${TAB} ${isActive ? "font-semibold text-brand-700 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}`
        }
      >
        {t(item.key)}
      </NavLink>
    );
  }

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_auto_1fr_1fr_1fr] items-center">
        {LEFT.map((item) => (
          <li key={item.to}>{tab(item)}</li>
        ))}
        <li className="flex justify-center">
          <Link
            to="/transactions/new"
            aria-label={t("nav.quickAdd")}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-3xl leading-none text-white shadow-lg ring-4 ring-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:ring-slate-900"
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
