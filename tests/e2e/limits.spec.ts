import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeOnboardingUi, openAmountKeypad } from "./helpers";

// Parcours « limites » : cas non couverts par les autres suites (suppressions protégées,
// objectifs, dettes, réconciliation, statistiques, import CSV en erreur, montants extrêmes).

async function typeAmount(page: Page, digits: string) {
  await openAmountKeypad(page);
  for (const key of digits) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

function categorySelect(page: Page): Locator {
  return page.locator("select").filter({ has: page.locator("option", { hasText: "Alimentation" }) });
}

/** Ajoute une dépense « Alimentation » et attend qu'elle apparaisse dans la liste. */
async function addExpense(page: Page, digits: string) {
  await page.getByRole("navigation", { name: "Accueil" }).getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await typeAmount(page, digits);
  const value = await categorySelect(page).locator("option", { hasText: "Alimentation" }).first().getAttribute("value");
  await categorySelect(page).selectOption(value ?? "");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("transaction-list")).toBeVisible();
}

async function openWallet(page: Page) {
  await page.goto("/plus");
  await page.getByRole("link", { name: "Portefeuilles" }).click();
  await page.getByRole("link", { name: /Compte BNI/ }).click();
}

/** Ouvre le menu « Plus d’actions » (éléments en role=menuitem). */
async function openWalletMenu(page: Page) {
  await page.getByRole("button", { name: "Plus d’actions" }).click();
}

/** Les confirmations du navigateur (window.confirm) sont acceptées explicitement. */
/** La confirmation est une feuille de l'application (titre « Confirmer »), plus une boîte native. */
async function confirmInSheet(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Confirmer" });
  await sheet.getByRole("button", { name: "Supprimer", exact: true }).click();
  // La feuille se referme en glissant : on attend qu'elle ait disparu (sinon son « Annuler » fait doublon).
  await expect(sheet).toHaveCount(0);
}

test("portefeuille utilisé : la suppression est refusée", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await addExpense(page, "1500");
  await openWallet(page);
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await confirmInSheet(page);
  await expect(
    page.getByText("Ce compte contient déjà des opérations. Vous pouvez le ranger en l’archivant."),
  ).toBeVisible();
});

test("catégorie utilisée : la suppression est refusée", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await addExpense(page, "1500");
  await page.goto("/plus");
  await page.getByRole("link", { name: "Catégories" }).click();
  await page.getByRole("link", { name: /Alimentation/ }).click();
  // La fiche est en lecture seule : la suppression se fait depuis le formulaire de modification.
  await page.getByRole("link", { name: "Modifier", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).last().click();
  await confirmInSheet(page);
  await expect(page.getByText(/Cette catégorie contient déjà des opérations/)).toBeVisible();
});

test("montant zéro : la saisie est refusée", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.getByRole("navigation", { name: "Accueil" }).getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await typeAmount(page, "0");
  // Montant nul : le bouton reste désactivé, rien n'est créé.
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await expect(page).toHaveURL(/transactions\/new/);
});

test("montant très grand (15 chiffres) : affiché sans débordement", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await addExpense(page, "123456789012345");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("suppression d'une transaction : « Annuler » la restaure", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await addExpense(page, "4200");
  await expect(page.getByTestId("transaction-list")).toContainText("4.200");
  await page.getByTestId("transaction-list").getByText("Alimentation").first().click();
  // La fiche est en lecture seule : modifier, puis supprimer depuis le menu d'actions.
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page.getByRole("button", { name: "Plus d’actions" }).click();
  // La suppression depuis la feuille demande confirmation, puis propose « Annuler ».
  await page.getByRole("menuitem", { name: "Supprimer", exact: true }).click();
  await confirmInSheet(page);
  await expect(page.getByTestId("transaction-list")).not.toContainText("4.200");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByTestId("transaction-list")).toContainText("4.200");
});

test("objectif d'épargne : création puis versement", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/plus");
  await page.getByRole("link", { name: "Objectifs d'épargne" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByLabel("Nom").fill("Voiture");
  await page.getByLabel(/Cible/).fill("100000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("link", { name: /Voiture/ }).click();
  await page.getByRole("button", { name: "Versement" }).click();
  await page.getByLabel(/Montant/).fill("25000");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText(/25\s?%/).first()).toBeVisible();
});

test("dette « Je dois » : paiement trop élevé refusé", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/plus");
  await page.getByRole("link", { name: "Dettes et prêts" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByLabel("À qui je dois").fill("Rakoto");
  await page.getByLabel("Montant initial").fill("50000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("link", { name: /Rakoto/ }).click();
  await page.getByLabel(/Paiement/).fill("60000");
  // Montant trop élevé : le bouton reste désactivé et le motif s’affiche.
  await expect(page.getByRole("button", { name: "Enregistrer le paiement" })).toBeDisabled();
  await expect(page.getByText("Ce montant est plus grand que ce qu’il reste à rembourser.")).toBeVisible();
});

test("réconciliation : l'écart crée un ajustement", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await addExpense(page, "1000");
  await openWallet(page);
  await openWalletMenu(page);
  await page.getByRole("menuitem", { name: "Réconcilier le solde" }).click();
  await page.getByLabel("Solde réel constaté").fill("5000");
  await expect(page.getByText(/Écart de /)).toBeVisible();
  await page.getByRole("button", { name: "Créer l'ajustement" }).click();
  await expect(page.getByText("Réconciliation enregistrée.")).toBeVisible();
});

test("statistiques : graphiques affichés après une dépense", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await addExpense(page, "7000");
  await page.getByRole("navigation", { name: "Accueil" }).getByRole("link", { name: "Visualisation" }).click();
  await expect(page.getByRole("heading", { name: "Dépenses par catégorie" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top 10 des dépenses" })).toBeVisible();
});

test("import CSV : lignes invalides signalées sans bloquer les bonnes", async ({ page }, testInfo) => {
  await completeOnboardingUi(page, "Compte BNI");
  mkdirSync(testInfo.outputDir, { recursive: true });
  const file = join(testInfo.outputDir, "bad.csv");
  writeFileSync(
    file,
    [
      "Date,Type,Category,Amount,Currency,Memo,Wallet",
      '"01/15/2026, 10:00",expense,Alimentation,5000,MGA,Bon,Compte BNI',
      '"13/45/2026, 10:00",expense,Alimentation,5000,MGA,Date cassée,Compte BNI',
      '"01/16/2026, 10:00",expense,Alimentation,abc,MGA,Montant cassé,Compte BNI',
    ].join("\n"),
  );
  await page.goto("/plus");
  await page.getByRole("link", { name: "Import / Export" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(file);
  // Ce fichier est au format MM/JJ/AAAA : on le choisit avant l'aperçu.
  await page.getByLabel(/MM\/JJ\/AAAA/).check();
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(page.getByText(/1 transaction\(s\) à importer/)).toBeVisible();
  await expect(page.getByText("Lignes en erreur (non importées) :")).toBeVisible();
});

test("débordement de page : aucune page sans défilement horizontal", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  for (const path of ["/", "/transactions", "/stats", "/budgets", "/plus", "/calendar"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect.soft(overflow, `défilement horizontal sur ${path}`).toBe(false);
  }
});
