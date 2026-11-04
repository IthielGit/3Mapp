import { useEffect, useState, type ReactNode } from "react";
import { ThemeContext, type ThemeMode } from "./theme-context";

const STORAGE_KEY = "theme";
const QUERY = "(prefers-color-scheme: dark)";

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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Préférence non sauvegardée : le thème reste actif pour la session.
    }
  }, [theme, resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
  );
}
