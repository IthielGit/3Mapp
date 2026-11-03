import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ITEMS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/transactions", key: "nav.transactions" },
  { to: "/stats", key: "nav.stats" },
  { to: "/budgets", key: "nav.budgets" },
  { to: "/plus", key: "nav.more" },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  return (
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
                [
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-xs",
                  isActive
                    ? "font-semibold text-brand-700 dark:text-brand-500"
                    : "text-slate-500 dark:text-slate-400",
                ].join(" ")
              }
            >
              {t(item.key)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
