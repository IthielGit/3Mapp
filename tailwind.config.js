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
        // Palette chaleureuse : bleu-vert profond pour les actions, fond crème, rouge réservé aux dépenses et aux suppressions.
        // brand-700 (bleu-vert) est la couleur d’action principale ; brand-300 (clair) sert aux textes sombres.
        brand: {
          50: "#f0faf9",
          100: "#d9f2ef",
          200: "#b3e4de",
          300: "#f5f5f7",
          400: "#4fa39a",
          500: "#2d8a80",
          600: "#13776e",
          700: "#0f766e",
          800: "#0b5d57",
          900: "#084642",
        },
        accent: { DEFAULT: "#ee4444", 600: "#d93a3a" },
        canvas: "#f6f3ee",
        ink: "#1a1a1b",
        card: "#26262d",
        page: "#1c1c22",
        raised: "#32323a",
        fg: "#f5f5f7",
        muted: "#b8b8c0",
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
        card: "1.25rem",
      },
    },
  },
  plugins: [],
};
