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
  await page.getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByRole("button", { name: "Restaurer" })).toBeVisible();
});
