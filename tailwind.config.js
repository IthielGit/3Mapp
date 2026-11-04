/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Inter, hébergée dans l'app (@fontsource) pour fonctionner hors ligne.
        sans: [
          "Outfit",
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
        // Palette « Cosmo » : noir pour les actions et les textes, gris de fond, rouge en accent ponctuel.
        // brand-700 (noir) est la couleur d'action principale ; brand-300 (clair) sert aux textes sombres.
        brand: {
          50: "#f5f5f7",
          100: "#e8e8ec",
          200: "#d4d4da",
          300: "#f5f5f7",
          400: "#8e8e96",
          500: "#5c5c64",
          600: "#3f3f45",
          700: "#1a1a1b",
          800: "#111112",
          900: "#0a0a0b",
        },
        accent: { DEFAULT: "#ee4444", 600: "#d93a3a" },
        canvas: "#f0f1f6",
        ink: "#1a1a1b",
        card: "#635d56",
        page: "#55504b",
        raised: "#726b63",
        fg: "#faf7f3",
        muted: "#ebe5dc",
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
