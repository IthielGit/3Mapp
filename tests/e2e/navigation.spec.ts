import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await completeOnboardingUi(page);
});

test("navigation entre les 5 pages sur mobile", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();

  const tabs: Array<[string, string]> = [
    ["Transactions", "Transactions"],
    ["Stats", "Statistiques"],
    ["Budgets", "Budgets"],
    ["Paramètres", "Paramètres"],
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
