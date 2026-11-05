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
          // Le menu natif suit le thème (color-scheme) : texte et fond lisibles dans les deux modes.
          className="cursor-pointer appearance-none rounded-lg bg-transparent px-2 py-1 pr-7 text-center text-xl font-semibold text-ink [color-scheme:light] outline-none focus:bg-slate-100 dark:text-fg dark:[color-scheme:dark] dark:focus:bg-raised"
        >
          <option value="stats" className="bg-white text-ink dark:bg-card dark:text-fg">
            {t("nav.stats")}
          </option>
          <option value="calendar" className="bg-white text-ink dark:bg-card dark:text-fg">
            {t("nav.calendar")}
          </option>
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
