import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("créer un budget par catégorie et le voir avec son reste", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/budgets");
  await page.getByRole("link", { name: "Ajouter" }).click();

  await page.getByLabel("Nom").fill("Courses");
  await page.getByLabel(/Montant/).fill("100000");
  await page.getByRole("checkbox", { name: /Alimentation/ }).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Courses")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Courses" })).toBeVisible();
  await expect(page.getByText(/Reste/)).toBeVisible();
});
