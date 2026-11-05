import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("sans paie définie, la carte demande le jour et le revenu, puis disparaît", async ({ page }) => {
  await completeOnboardingUi(page);

  await expect(page.getByText("Quand touchez-vous votre paie ?")).toBeVisible();
  await page.getByLabel("Jour du mois").selectOption("28");
  await page.getByLabel("Revenu concerné").selectOption({ label: "Salaire" });
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByText("Quand touchez-vous votre paie ?")).toHaveCount(0);
});
