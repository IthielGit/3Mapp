/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Inter, hébergée dans l'app (@fontsource) pour fonctionner hors ligne.
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Palette « bleu calme » : marque, boutons, liens, onglets actifs.
        // brand-700 (#1E40AF) est la couleur principale ; le texte clair s'utilise en mode sombre.
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        // Sémantique : revenus (vert profit), dépenses (rouge alerte). Variantes pour le mode sombre.
        income: { DEFAULT: "#047857", dark: "#34d399" },
        expense: { DEFAULT: "#b91c1c", dark: "#f87171" },
      },
      transitionTimingFunction: {
        // Courbes fortes (et non les « ease » intégrées, trop molles) : sortie rapide pour l'interface.
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      borderRadius: {
        card: "1rem",
      },
    },
  },
  plugins: [],
};
