import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("sauvegarde puis restauration sur un navigateur vierge : mêmes soldes", async ({
  page,
  browser,
}) => {
  await completeOnboardingUi(page, "Compte BNI");

  // Une dépense de 1 500 au clavier.
  await page.getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  for (const key of ["1", "5", "0", "0"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("1 500");

  await page
    .getByRole("navigation", { name: "Accueil" })
    .getByRole("link", { name: "Accueil" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  const balanceBefore = await page.locator("[data-amount]").first().innerText();

  // Sauvegarde en clair, téléchargée par le navigateur.
  await page.getByRole("link", { name: "Plus" }).click();
  await page.getByRole("link", { name: "Sauvegarde et restauration" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Télécharger la sauvegarde" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("téléchargement introuvable");
  expect(download.suggestedFilename()).toMatch(/^money-manager-\d{4}-\d{2}-\d{2}\.json$/);
  expect(readFileSync(path, "utf8")).toContain("money-manager/backup");

  // Nouveau contexte : aucun stockage local, comme un téléphone neuf.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const fresh = await context.newPage();
  await fresh.goto("/");
  await expect(fresh.getByRole("link", { name: "J'ai déjà une sauvegarde" })).toBeVisible();
  await fresh.getByRole("link", { name: "J'ai déjà une sauvegarde" }).click();

  await fresh.getByLabel("Choisir un fichier de sauvegarde").setInputFiles(path);
  await expect(fresh.getByText(/enregistrements\.$/)).toBeVisible();
  await fresh.getByLabel("Remplacer toutes les données").check();
  await fresh.getByLabel("Je comprends que les données actuelles seront effacées.").check();
  await fresh.getByRole("button", { name: "Restaurer", exact: true }).click();
  await expect(fresh.getByText("Restauration terminée")).toBeVisible();

  await fresh.getByRole("link", { name: "Aller à l'accueil" }).click();
  await expect(fresh.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  await expect(fresh.locator("[data-amount]").first()).toHaveText(balanceBefore);

  await context.close();
});
