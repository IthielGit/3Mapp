import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("nouvelle transaction : pas d'option Ajustement, mais Dépense, Revenu et Virement", async ({
  page,
}) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page
    .getByRole("navigation", { name: "Accueil" })
    .getByRole("link", { name: "Transactions" })
    .click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await expect(page.getByRole("radio", { name: "Dépense" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Revenu" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Virement" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Ajustement" })).toHaveCount(0);
});
