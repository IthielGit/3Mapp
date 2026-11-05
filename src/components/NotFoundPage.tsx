import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buttonPrimary } from "./FormControls";

/** Adresse inconnue : on le dit, au lieu de renvoyer silencieusement à l'accueil. */
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink dark:text-fg">{t("errors.pageNotFound")}</h1>
      <Link to="/" className={`${buttonPrimary} inline-flex items-center`}>
        {t("errors.backHome")}
      </Link>
    </section>
  );
}
