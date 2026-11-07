import { expect, test } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad, pickFoodCategory } from "./helpers";

test.beforeEach(async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
});

test("saisir une dépense au clavier puis la retrouver dans la liste", async ({ page }) => {
  await page.getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await openAmountKeypad(page);
  for (const key of ["1", "5", "0", "0"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await pickFoodCategory(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("1.500");
});


test("tout sélectionner puis tout désélectionner dans la liste des transactions", async ({ page }) => {
  for (const amount of ["1", "2"]) {
    await page.getByRole("link", { name: "Transactions" }).click();
    await page.getByRole("link", { name: "Nouvelle transaction" }).click();
    await openAmountKeypad(page);
    await page.getByRole("button", { name: amount, exact: true }).click();
    await pickFoodCategory(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
  }
  await page.getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("button", { name: "Sélectionner", exact: true }).click();

  const selectAll = page.getByRole("button", { name: "Tout sélectionner", exact: true });
  await selectAll.click();
  await expect(page.getByText("2 sélectionnée(s)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout désélectionner", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Tout désélectionner", exact: true }).click();
  await expect(page.getByText("0 sélectionnée(s)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout sélectionner", exact: true })).toBeVisible();
});
