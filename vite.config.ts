import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "Gestionnaire de budget",
        short_name: "Budget",
        description: "Gestion de finances personnelles, hors ligne.",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#0f766e",
        icons: [{ src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
        shortcuts: [
          {
            name: "Ajouter une dépense",
            short_name: "Dépense",
            url: "/transactions/new?type=expense",
          },
          { name: "Ajouter un revenu", short_name: "Revenu", url: "/transactions/new?type=income" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
});
