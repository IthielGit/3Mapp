import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
});

test("saisir une dépense au clavier puis la retrouver dans la liste", async ({ page }) => {
  await page.getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  for (const key of ["1", "5", "0", "0"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("1 500");
});

test("liste virtualisée : 5 000 lignes de démo, peu d’éléments rendus", async ({ page }) => {
  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("button", { name: "Générer 5 000 transactions de démo" }).click();
  await expect(page.getByText("5000 transactions de démo ajoutées.")).toBeVisible({
    timeout: 60_000,
  });

  await page
    .getByRole("navigation", { name: "Accueil" })
    .getByRole("link", { name: "Transactions" })
    .click();
  await expect(page.getByTestId("transaction-list")).toBeVisible();
  await expect(page.locator('[data-testid="transaction-list"] [data-index]').first()).toBeVisible({
    timeout: 15_000,
  });
  const rendered = await page.locator('[data-testid="transaction-list"] [data-index]').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(60);
});
