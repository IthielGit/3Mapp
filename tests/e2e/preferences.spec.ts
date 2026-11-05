import { expect, test } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad, pickFoodCategory } from "./helpers";

test("touche de zéros : « 00 » choisi dans Paramètres apparaît sur le clavier", async ({
  page,
}) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/plus");
  await page.getByLabel("Touche zéros du clavier").selectOption("2");

  await page
    .getByRole("navigation", { name: "Accueil" })
    .getByRole("link", { name: "Transactions" })
    .click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await openAmountKeypad(page);
  await expect(page.getByRole("button", { name: "00", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "000", exact: true })).toHaveCount(0);
});

test("touche de zéros par défaut : « 000 »", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page
    .getByRole("navigation", { name: "Accueil" })
    .getByRole("link", { name: "Transactions" })
    .click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await openAmountKeypad(page);
  await expect(page.getByRole("button", { name: "000", exact: true })).toBeVisible();
});

test("récurrence à la création : la case crée une récurrence visible", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page
    .getByRole("navigation", { name: "Accueil" })
    .getByRole("link", { name: "Transactions" })
    .click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await page.getByRole("button", { name: "Plus de détails" }).click();
  await page.getByLabel("Répéter (récurrence)").check();
  await openAmountKeypad(page);
  for (const key of ["1", "0", "0", "0"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await pickFoodCategory(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/plus");
  await page.getByRole("link", { name: "Récurrences et modèles" }).click();
  await expect(page.getByText("Aucune récurrence")).toHaveCount(0);
});
