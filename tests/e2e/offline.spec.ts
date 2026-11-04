import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("hors ligne : l'app se charge depuis le cache et affiche les données locales", async ({
  page,
  context,
}) => {
  await completeOnboardingUi(page, "Compte BNI");

  // Premier chargement : le service worker s'installe ; il contrôle la page au rechargement suivant.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  // Le service worker doit contrôler la page avant de couper le réseau.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
    timeout: 30_000,
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();

  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  await expect(page.locator("[data-amount]").first()).toBeVisible();

  // Une autre page de l'application (route gérée côté client) fonctionne aussi hors ligne.
  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("link", { name: "Ajouter une transaction" })).toBeVisible();

  await context.setOffline(false);
});
