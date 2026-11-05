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
        // Palette chaleureuse : bleu-vert profond pour les actions (brand-600), fond crème,
        // rouge réservé aux dépenses et aux suppressions. brand-dark (teal clair) n'existe qu'en mode sombre.
        brand: {
          50: "#EEFAFE",
          100: "#D9F5FC",
          200: "#B3EAF9",
          300: "#7ADBF5",
          400: "#2EC6F0",
          500: "#0FA7D1",
          600: "#0B7E9D",
          700: "#096780",
          800: "#075064",
          900: "#053947",
          // Teal clair : accent réservé au mode sombre (onglets actifs, boutons, liens).
          dark: "#7ADBF5",
        },
        neutral: {
          50: "#F9FAFA",
          100: "#F3F4F4",
          200: "#E3E6E8",
          300: "#D0D5D7",
          400: "#A1ABAF",
          500: "#6C787F",
          600: "#4D565B",
          700: "#3D4448",
          800: "#262A2C",
          900: "#171A1C",
        },
        canvas: "#F2F4F5",
        ink: "#223135",
        card: "#26262d",
        page: "#1c1c22",
        raised: "#32323a",
        fg: "#f5f5f7",
        muted: "#b8b8c0",
        // Sémantique : revenus (vert profit), dépenses (rouge alerte). Variantes pour le mode sombre.
        income: { DEFAULT: "#11745B", dark: "#67E9C9" },
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
