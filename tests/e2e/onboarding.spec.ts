import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("premier lancement : onboarding crée le premier portefeuille", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");

  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Portefeuilles" }).click();
  await expect(page.getByText("Compte BNI")).toBeVisible();
});

test("archivage puis restauration d'un portefeuille", async ({ page }) => {
  await completeOnboardingUi(page, "Espèces");
  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Portefeuilles" }).click();
  await page.getByRole("link", { name: /Espèces/ }).click();
  await page.getByRole("button", { name: "Plus d’actions" }).click();
  await page.getByRole("menuitem", { name: "Archiver" }).click();
  await page.getByRole("button", { name: "Plus d’actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Restaurer" })).toBeVisible();
});
