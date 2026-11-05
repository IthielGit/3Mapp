import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

/** Bouton retour rond : revient à l'écran précédent, ou à l'accueil si l'app vient d'être ouverte sur cette page. */
export function BackButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      type="button"
      aria-label={t("common.back")}
      onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/"))}
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
  );
}
