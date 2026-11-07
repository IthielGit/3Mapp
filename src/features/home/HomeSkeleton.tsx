import { useTranslation } from "react-i18next";
import { HomeHeader } from "./HomeHeader";

const block = "rounded-card border border-neutral-200 bg-white dark:border-white/10 dark:bg-card";
const bar = "rounded-full bg-neutral-200 dark:bg-white/10";

/**
 * Accueil en cours de chargement : mêmes formes que l'accueil (en-tête, carte du mois, deux sections),
 * sans aucun chiffre. Évite d'afficher « 0 Ar » ou « Aucune transaction » avant que les données arrivent.
 * Pulsation lente et discrète, coupée si « réduire les animations » est activé.
 */
export function HomeSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-busy="true" className="-mx-4 flex flex-col gap-5 px-4">
      <h1 className="sr-only">{t("nav.home")}</h1>
      <HomeHeader />
      <p role="status" className="sr-only">
        {t("home.status.loading")}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-5 motion-safe:animate-pulse">
        <div className={`${block} flex flex-col gap-4 p-4`}>
          <div className={`${bar} h-3 w-28`} />
          <div className={`${bar} h-9 w-48`} />
          <div className={`${bar} h-2 w-full`} />
          <div className="flex gap-3">
            <div className={`${bar} h-3 w-20`} />
            <div className={`${bar} h-3 w-24`} />
          </div>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className={`${bar} h-4 w-32`} />
            <div className={`${block} flex flex-col gap-4 p-4`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-200 dark:bg-white/10" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className={`${bar} h-3 w-2/3`} />
                  <div className={`${bar} h-2.5 w-1/3`} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-200 dark:bg-white/10" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className={`${bar} h-3 w-1/2`} />
                  <div className={`${bar} h-2.5 w-1/4`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
