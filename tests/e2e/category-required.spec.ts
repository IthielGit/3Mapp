import { expect, test } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad } from "./helpers";

test("catégorie obligatoire : refusée sans catégorie, création rapide puis enregistrée", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/transactions/new");
  await openAmountKeypad(page);
  for (const key of ["3", "0", "0", "0"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Choisissez une catégorie, ou créez-en une.")).toBeVisible();
  await expect(page).toHaveURL(/transactions\/new/);

  // Pas de catégorie adaptée : on en crée une depuis le formulaire.
  await page.getByRole("button", { name: "+ Nouvelle catégorie" }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Café");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.locator("select").filter({ has: page.locator("option", { hasText: "Café" }) })).toHaveValue(/.+/);

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("3.000");
  await expect(page.getByTestId("transaction-list")).toContainText("Café");
});
