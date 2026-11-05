import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await completeOnboardingUi(page);
});

test("navigation entre les pages de la barre basse sur mobile", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();

  const tabs: Array<[string, string]> = [
    ["Transactions", "Transactions"],
    ["Budgets", "Budgets"],
    ["Visualisation", "Calendrier"],
    ["Accueil", "Accueil"],
  ];
  for (const [tab, heading] of tabs) {
    await page
      .getByRole("navigation", { name: "Accueil" })
      .getByRole("link", { name: tab })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("pas de défilement horizontal sur mobile", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("retour quitte Visualisation au lieu de passer de Calendrier à Analyses", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  await page.getByRole("navigation", { name: "Accueil" }).getByRole("link", { name: "Visualisation" }).click();
  await page.getByRole("navigation", { name: "Visualisation" }).getByRole("link", { name: "Analyses" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Analyses" })).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
});
