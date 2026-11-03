import { expect, test } from "@playwright/test";

test("navigation entre les 5 pages sur mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();

  const tabs: Array<[string, string]> = [
    ["Transactions", "Transactions"],
    ["Stats", "Statistiques"],
    ["Budgets", "Budgets"],
    ["Plus", "Plus"],
    ["Accueil", "Accueil"],
  ];
  for (const [tab, heading] of tabs) {
    await page.getByRole("navigation").getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("pas de défilement horizontal sur mobile", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
