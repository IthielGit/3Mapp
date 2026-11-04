import { createContext, useContext } from "react";

/** Choix de l'utilisateur ; « system » suit le réglage du téléphone. */
export type ThemeMode = "system" | "light" | "dark";

export interface ThemeContextValue {
  theme: ThemeMode;
  /** Thème réellement affiché après résolution de « system ». */
  resolved: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé dans un ThemeProvider");
  return ctx;
}
