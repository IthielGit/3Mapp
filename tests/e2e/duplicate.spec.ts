import { expect, test, type Page } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad } from "./helpers";

async function typeAmount(page: Page, digits: string) {
  await openAmountKeypad(page);
  for (const key of digits) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

test("dupliquer : le formulaire s'ouvre pré-rempli, la copie n'est enregistrée qu'à la validation", async ({
  page,
}) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/transactions/new");
  await typeAmount(page, "4200");
  const category = page.locator("select").filter({ has: page.locator("option", { hasText: "Alimentation" }) });
  const value = await category.locator("option", { hasText: "Alimentation" }).first().getAttribute("value");
  await category.selectOption(value ?? "");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("4.200");

  // Ouvrir la fiche, puis « Dupliquer » depuis le menu de la feuille de modification.
  await page.getByTestId("transaction-list").getByText("Alimentation").first().click();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page.getByRole("button", { name: "Plus d’actions" }).click();
  await page.getByRole("menuitem", { name: "Dupliquer", exact: true }).click();

  // Le formulaire de création s'ouvre avec le même montant, rien n'est encore enregistré.
  await expect(page).toHaveURL(/transactions\/new\?from=/);
  await expect(page.getByText("4.200 Ar").first()).toBeVisible();
  await expect(page.getByTestId("transaction-list").getByText("Alimentation")).toHaveCount(1);

  // Validation : la copie apparaît dans la liste.
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list").getByText("Alimentation")).toHaveCount(2);
});
