import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { ThemeProvider } from "./lib/theme";
import "./i18n";
import "./index.css";

// Le bandeau « Nouvelle version disponible » arrive en Phase 13 ; pour l'instant la mise à jour
// s'applique à la prochaine ouverture (enregistrement silencieux du service worker).
registerSW({ immediate: true });

// Demande au navigateur de ne pas purger les données locales (SPEC §2).
void navigator.storage?.persist?.().catch(() => undefined);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Élément #root introuvable");

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
