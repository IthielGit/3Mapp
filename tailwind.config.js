/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Couleur de marque : teal. Nuances complètes pour fonds, bordures et textes.
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        // Sémantique : revenus et dépenses (contrastes AA sur fond clair et sombre).
        income: { DEFAULT: "#0369a1", dark: "#38bdf8" },
        expense: { DEFAULT: "#be123c", dark: "#fb7185" },
      },
      borderRadius: {
        card: "1rem",
      },
    },
  },
  plugins: [],
};
