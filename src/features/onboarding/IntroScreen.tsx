import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../components/BrandMark";

/**
 * Écran d'introduction : toujours sombre (fond noir dans les deux thèmes), marque au-dessus
 * de l'accroche, une forme chromée qui monte du bas, et le bouton blanc près du bord inférieur.
 */
export function IntroScreen({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="flex h-dvh flex-col overflow-hidden bg-page text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-end px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex flex-col gap-6">
          <span className="flex items-center gap-3 text-lg font-semibold">
            <BrandMark size={36} className="shrink-0 rounded-xl shadow-lg" />
            {t("app.title")}
          </span>
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight">
            {t("onboarding.introLead")}{" "}
            <span className="whitespace-nowrap">
              <span className="text-brand-dark">{t("onboarding.introAccent")}</span>
              {t("onboarding.introEnd")}
            </span>
          </h1>
          <p className="max-w-xs text-base text-muted">{t("onboarding.slide1.text")}</p>
        </div>
      </div>

      {/* Forme chromée : entre par le bas au premier affichage. */}
      <div
        aria-hidden="true"
        className="intro-chrome pointer-events-none relative min-h-0 w-full flex-1 overflow-hidden"
      >
        <div className="absolute -bottom-24 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(160deg,#f5f5f7_0%,#8e8e96_22%,#1a1a1b_48%,#d4d4da_70%,#5c5c64_100%)] opacity-90 blur-[1px]" />
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onStart}
          className="relative z-10 flex min-h-[60px] items-center justify-between rounded-2xl bg-white px-6 text-base font-semibold text-ink transition-transform duration-150 ease-out-strong active:scale-[0.98] motion-reduce:active:scale-100"
        >
          <span>{t("onboarding.introStart")}</span>
          <span aria-hidden="true" className="text-xl">
            →
          </span>
        </button>
        <Link to="/restore" className="text-center text-sm font-medium text-muted underline">
          {t("onboarding.restoreLink")}
        </Link>
      </div>
    </section>
  );
}
