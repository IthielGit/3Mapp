import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type View = "stats" | "calendar";

/**
 * Onglet « Visualisation » : le titre est la liste de choix (Analyses ou Calendrier).
 * Changer de vue remplace l’entrée d’historique : « retour » quitte l’écran.
 */
export function VisualisationLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const view: View = location.pathname.endsWith("/calendar") ? "calendar" : "stats";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="relative mx-auto inline-flex items-center gap-1 text-center text-xl font-semibold text-ink dark:text-fg">
        <label className="sr-only" htmlFor="visualisation-view">
          {t("nav.visualisation")}
        </label>
        <select
          id="visualisation-view"
          value={view}
          onChange={(e) => navigate(`/visualisation/${e.target.value}`, { replace: true })}
          className="cursor-pointer appearance-none bg-transparent pr-6 text-center text-xl font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand-700 dark:text-fg"
        >
          <option value="stats">{t("nav.stats")}</option>
          <option value="calendar">{t("nav.calendar")}</option>
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </h1>
      <Outlet />
    </div>
  );
}
