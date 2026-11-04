import type { Page } from "@playwright/test";

/** Parcourt l'onboarding complet via l'interface (premier lancement). */
export async function completeOnboardingUi(page: Page, walletName = "Compte BNI"): Promise<void> {
  await page.goto("/");
  await page
    .getByRole("heading", { level: 1, name: "Vos finances deviennent simples !" })
    .waitFor();
  await page.getByRole("button", { name: "Commencer" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Suivant" }).click();
  }
  await page.getByLabel("Nom").fill(walletName);
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("heading", { level: 1, name: "Accueil" }).waitFor();
}
