import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeContext, type ThemeMode } from "./theme-context";

const STORAGE_KEY = "theme";
const QUERY = "(prefers-color-scheme: dark)";

/** Document avec la View Transition API (absente de certains navigateurs). */
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Stockage indisponible (mode privé, données bloquées) : valeur par défaut.
  }
  return "system";
}

function systemIsDark(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

/** Le thème suit « system » en direct quand le téléphone change de mode. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState<boolean>(systemIsDark);

  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Au premier affichage : bascule immédiate. Ensuite, la bascule passe dans une transition de vue
  // (fondu croisé d'un instantané de la page, animé sur l'opacité, donc sur le GPU). Sans cette API,
  // le changement est immédiat : pas de peinture coûteuse de chaque élément.
  const firstRender = useRef(true);
  useEffect(() => {
    const dark = resolved === "dark";
    const doc = document as ViewTransitionDocument;
    const isFirst = firstRender.current;
    firstRender.current = false;
    if (isFirst || !doc.startViewTransition) {
      applyDarkClass(dark);
      return;
    }
    doc.startViewTransition(() => applyDarkClass(dark));
  }, [resolved]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Préférence non sauvegardée : le thème reste actif pour la session.
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
  );
}
