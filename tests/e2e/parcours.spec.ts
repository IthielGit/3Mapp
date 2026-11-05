import { expect, test, type Locator, type Page } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad } from "./helpers";

async function typeAmount(page: Page, digits: string) {
  await openAmountKeypad(page);
  for (const key of digits) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

/** Choisit, dans la liste `select`, l'option dont le texte contient `text`. */
async function selectOptionContaining(select: Locator, text: string) {
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  await select.selectOption(value ?? "");
}

/** La liste « Vers » (destination d'un virement) : son libellé enveloppe le <select>. */
function destinationSelect(page: Page): Locator {
  return page.locator("label").filter({ hasText: /^Vers/ }).locator("select");
}

/** La liste de catégorie de la feuille de transaction (la seule qui propose « Alimentation »). */
function categorySelect(page: Page): Locator {
  return page
    .locator("select")
    .filter({ has: page.locator("option", { hasText: "Alimentation" }) });
}

async function goToTab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Accueil" }).getByRole("link", { name }).click();
}

test("virement entre deux portefeuilles : le portefeuille de destination reçoit le montant", async ({
  page,
}) => {
  await completeOnboardingUi(page, "Compte BNI");

  // Second portefeuille.
  await page.goto("/plus");
  await page.getByRole("link", { name: "Portefeuilles" }).click();
  await page.getByRole("link", { name: "Ajouter" }).click();
  await page.getByLabel("Nom").fill("Mobile Money");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Mobile Money")).toBeVisible();

  // Virement de 2 000 du compte BNI vers Mobile Money.
  await goToTab(page, "Transactions");
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await page.getByRole("radio", { name: "Virement" }).click();
  await typeAmount(page, "2000");
  await selectOptionContaining(destinationSelect(page), "Mobile Money");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("2.000");

  // Le solde du portefeuille de destination passe à 2 000.
  await page.goto("/plus");
  await page.getByRole("link", { name: "Portefeuilles" }).click();
  await page.getByRole("link", { name: /Mobile Money/ }).click();
  await expect(page.getByText("2.000").first()).toBeVisible();
});

test("budget dépassé : une dépense au-delà du plafond est signalée", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");

  // Budget « Courses » de 50 000 sur la catégorie Alimentation.
  await await page.goto("/budgets");
  await page.getByRole("link", { name: "Ajouter" }).click();
  await page.getByLabel("Nom").fill("Courses");
  await page.getByLabel(/Montant/).fill("50000");
  await page.getByRole("checkbox", { name: /Alimentation/ }).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Courses")).toBeVisible();

  // Dépense de 60 000 dans la même catégorie.
  await goToTab(page, "Transactions");
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await typeAmount(page, "60000");
  await selectOptionContaining(categorySelect(page), "Alimentation");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("60");

  // Le budget affiche le dépassement.
  await await page.goto("/budgets");
  await expect(page.getByText(/Dépassé de/)).toBeVisible();
});
