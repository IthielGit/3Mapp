import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

const TABS = [
  { to: "/visualisation/calendar", key: "nav.calendar" },
  { to: "/visualisation/stats", key: "nav.stats" },
] as const;

/** Onglet « Visualisation » : Calendrier et Analyses côte à côte, sans passer par « Plus ». */
export function VisualisationLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("nav.visualisation")}>
        <ul className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-raised">
          {TABS.map((tab) => (
            <li key={tab.to}>
              {/* replace : changer d’onglet ne crée pas d’entrée dans l’historique, donc « retour » quitte l’écran. */}
              <NavLink
                to={tab.to}
                replace
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white font-semibold text-ink shadow-sm dark:bg-card dark:text-fg"
                      : "text-slate-600 dark:text-muted"
                  }`
                }
              >
                {t(tab.key)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
