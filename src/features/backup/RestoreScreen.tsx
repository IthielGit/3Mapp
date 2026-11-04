import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { BackupPage } from "./BackupPage";

/**
 * Restauration depuis l'écran d'accueil (avant l'onboarding) : hors de la mise en page
 * principale, donc avec sa propre rangée de retour.
 */
export function RestoreScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-6 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="-mx-2 flex min-h-11 items-center">
        <button
          type="button"
          aria-label={t("common.back")}
          onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/onboarding"))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
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
      <BackupPage />
    </div>
  );
}
