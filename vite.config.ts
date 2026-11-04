import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    // ExcelJS (≈930 Ko) n'est chargé qu'à l'export XLSX, jamais au démarrage : il est isolé dans
    // son propre chunk. Le seuil est relevé en conséquence ; le reste du code reste sous 500 Ko.
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "icons/icon.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
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
        icons: [
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
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
