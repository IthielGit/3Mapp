import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BottomNav, SideNav } from "./BottomNav";
import { BackButton } from "./BackButton";
import { Icon } from "./Icon";
import { UpdateBanner } from "./PwaComponents";
import { HeaderSlotsContext } from "./header-slots";
import { generateDueOccurrences } from "../features/recurring/recurring-service";
import { useAppPreferences } from "../features/settings/app-preferences";

/** Destinations de la barre basse : pas de bouton retour sur ces écrans racines. */
const ROOTS = ["/", "/transactions", "/budgets", "/visualisation"];

/**
 * Ligne d'en-tête des écrans secondaires : bouton retour rond à gauche, titre de l'écran
 * à sa hauteur, actions (menu « ⋯ ») à droite.
 */
function HeaderRow({
  onTitleSlot,
  onActionsSlot,
}: {
  onTitleSlot: (el: HTMLDivElement | null) => void;
  onActionsSlot: (el: HTMLDivElement | null) => void;
}) {
  return (
    // Collée en haut pendant le défilement ; son fond couvre la zone de l'encoche.
    <div className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] mb-3 flex min-h-11 items-center gap-3 bg-canvas px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-page">
      <BackButton />
      <div ref={onTitleSlot} className="flex min-w-0 flex-1 items-center" />
      <div ref={onActionsSlot} className="flex shrink-0 items-center justify-end" />
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

  // L’onglet Visualisation porte lui-même le bouton retour, sur la ligne de ses onglets.
  const showHeader = !ROOTS.includes(location.pathname) && !location.pathname.startsWith("/visualisation");
  // Sur téléphone, la barre basse n'a pas de place pour Paramètres : un lien discret en haut des écrans racines.
  const showSettingsLink = ROOTS.includes(location.pathname) && !location.pathname.startsWith("/visualisation");
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col md:max-w-none md:flex-row">
      <SideNav />
      <HeaderSlotsContext.Provider value={{ titleSlot, actionsSlot }}>
        <main className="flex-1 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] md:px-10 md:pb-10 md:pt-8">
          <div className="mx-auto w-full md:max-w-5xl">
            {showSettingsLink ? (
              <div className="mb-2 flex justify-end md:hidden">
                <Link
                  to="/plus"
                  className="flex min-h-[44px] items-center gap-2 rounded-full border border-neutral-200 px-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-white/15 dark:text-fg"
                >
                  <Icon name="sliders" className="h-4 w-4" />
                  {t("pages.more.title")}
                </Link>
              </div>
            ) : null}
            {showHeader ? (
              <HeaderRow onTitleSlot={setTitleSlot} onActionsSlot={setActionsSlot} />
            ) : null}
            <Outlet />
          </div>
        </main>
      </HeaderSlotsContext.Provider>
      <BottomNav />
      <UpdateBanner />
    </div>
  );
}
