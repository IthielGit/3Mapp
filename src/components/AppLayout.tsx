import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BottomNav } from "./BottomNav";
import { UpdateBanner } from "./PwaComponents";
import { generateDueOccurrences } from "../features/recurring/recurring-service";
import { useAppPreferences } from "../features/settings/app-preferences";

/** Destinations de la barre basse : pas de bouton retour sur ces écrans racines. */
const ROOTS = ["/", "/transactions", "/calendar", "/stats"];

/** Bouton retour rond, en haut, sur tous les écrans qui ne sont pas une destination racine. */
function BackBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="-mx-4 mb-2 flex items-center px-4">
      <button
        type="button"
        aria-label={t("common.back")}
        onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/"))}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  // Langue choisie dans Paramètres et rappel quotidien de saisie.
  useAppPreferences();

  // Rattrapage des récurrences à l'ouverture (SPEC §2, §5.7) : une passe par ouverture de l'app.
  useEffect(() => {
    void generateDueOccurrences().catch(() => undefined);
  }, []);

  const showBack = !ROOTS.includes(location.pathname);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
        {showBack ? <BackBar /> : null}
        <Outlet />
      </main>
      <BottomNav />
      <UpdateBanner />
    </div>
  );
}
