import type { Page } from "@playwright/test";

/** Parcourt l'onboarding complet via l'interface (premier lancement). */
export async function completeOnboardingUi(page: Page, walletName = "Compte BNI"): Promise<void> {
  await page.goto("/");
  // Pas d'écran d'introduction : la connexion en tient lieu. Deux écrans : devise, puis le compte et son solde.
  await page.getByRole("heading", { level: 1, name: "Votre devise" }).waitFor();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Nom").fill(walletName);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("heading", { level: 1, name: "Accueil" }).waitFor();
}

export async function openAmountKeypad(page: Page): Promise<void> {
  // Le pavé est replié à l'ouverture d'une transaction : on le déplie avant de saisir.
  await page.getByRole("button", { name: /Toucher pour saisir le montant/ }).click();
}

/** Choisit la catégorie « Alimentation » (obligatoire pour une dépense ou un revenu). */
export async function pickFoodCategory(page: Page): Promise<void> {
  const select = page.locator("select").filter({ has: page.locator("option", { hasText: "Alimentation" }) });
  const value = await select.locator("option", { hasText: "Alimentation" }).first().getAttribute("value");
  await select.selectOption(value ?? "");
}
