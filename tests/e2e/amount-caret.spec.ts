import { expect, test } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad } from "./helpers";

test("saisie du montant : la touche s'insère à la position du curseur", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/transactions/new");
  await openAmountKeypad(page);
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  const input = page.locator("#amount-expression");
  await expect(input).toHaveValue("20");

  // Curseur après « 2 », puis une touche : le chiffre entre au milieu, pas à la fin.
  await input.click();
  await input.press("Home");
  await input.press("ArrowRight");
  await page.getByRole("button", { name: "7", exact: true }).click();
  await expect(input).toHaveValue("270");

  // « ⌫ » efface le caractère avant le curseur (le curseur est maintenant après le 7).
  await input.click();
  await input.press("Home");
  await input.press("ArrowRight");
  await input.press("ArrowRight");
  await page.getByRole("button", { name: "Effacer" }).click();
  await expect(input).toHaveValue("20");
});
