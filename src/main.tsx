import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { ConfirmHost } from "./components/confirm";
import { SecurityProvider } from "./features/security/SecurityProvider";
import { AccountProvider } from "./features/account/AccountProvider";
import { AccountGate } from "./features/account/AccountGate";
import { ThemeProvider } from "./lib/theme";
import { UPDATE_CHECK_INTERVAL_MS, autoApplyUpdate, listenForInstallPrompt, publishUpdate } from "./lib/pwa";
import "./i18n";
import "@fontsource/outfit/latin-400.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "./index.css";

// Mise à jour : le bandeau « Nouvelle version disponible » propose de recharger (SPEC §5.17). Sans réponse,
// la mise à jour s'applique d'elle-même au lancement ou quand l'app passe en arrière-plan (jamais pendant une saisie).
const launchedAt = Date.now();
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    const apply = () => updateServiceWorker(true);
    publishUpdate(apply);
    autoApplyUpdate(apply, { launchedAt });
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    window.setInterval(() => void registration.update().catch(() => undefined), UPDATE_CHECK_INTERVAL_MS);
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
          <AccountProvider>
            <AccountGate>
              <App />
              <ConfirmHost />
            </AccountGate>
          </AccountProvider>
        </SecurityProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
