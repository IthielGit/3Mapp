import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { SecurityProvider } from "./features/security/SecurityProvider";
import { ThemeProvider } from "./lib/theme";
import { listenForInstallPrompt, publishUpdate } from "./lib/pwa";
import "./i18n";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./index.css";

// Mise à jour : le bandeau « Nouvelle version disponible » propose de recharger (SPEC §5.17).
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    publishUpdate(() => updateServiceWorker(true));
  },
});

// Mémorise l'invite d'installation du navigateur pour le bouton « Installer l'application ».
listenForInstallPrompt();

// Demande au navigateur de ne pas purger les données locales (SPEC §2).
void navigator.storage?.persist?.().catch(() => undefined);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Élément #root introuvable");

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <SecurityProvider>
          <App />
        </SecurityProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
