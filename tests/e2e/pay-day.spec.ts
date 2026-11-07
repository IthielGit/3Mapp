import { expect, test, type Page } from "@playwright/test";
import { completeOnboardingUi, openAmountKeypad, pickFoodCategory } from "./helpers";

const PAY_PROMPT = "Quand touchez-vous votre paie ?";

/** Une dépense : c'est ce qui fait passer le premier lancement à la question de paie. */
async function addFirstExpense(page: Page) {
  await page.getByRole("link", { name: "Transactions" }).click();
  await page.getByRole("link", { name: "Nouvelle transaction" }).click();
  await openAmountKeypad(page);
  for (const key of ["1", "0", "0"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  await pickFoodCategory(page);
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByRole("link", { name: "Accueil" }).click();
  await page.getByRole("heading", { level: 1, name: "Accueil" }).waitFor();
}

test("premier lancement : la carte demande le solde de départ, pas la paie", async ({ page }) => {
  await completeOnboardingUi(page);

  await expect(page.getByText(/Pour commencer, indiquez/)).toBeVisible();
  await expect(page.getByText(PAY_PROMPT)).toHaveCount(0);
});

test("après une première dépense : la paie se règle dans une feuille, puis la question disparaît", async ({ page }) => {
  await completeOnboardingUi(page);
  await addFirstExpense(page);

  await expect(page.getByText(PAY_PROMPT)).toBeVisible();
  await page.getByRole("button", { name: "Répondre", exact: true }).click();
  await page.getByLabel("Salaire à date fixe").check();
  await page.getByLabel("Jour du mois").selectOption("28");
  await page.getByLabel("Revenu concerné").selectOption({ label: "Salaire" });
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByText(PAY_PROMPT)).toHaveCount(0);
});

test("revenus irréguliers : la réponse reste après rechargement", async ({ page }) => {
  await completeOnboardingUi(page);
  await addFirstExpense(page);

  await page.getByRole("button", { name: "Répondre", exact: true }).click();
  await page.getByLabel("Revenus irréguliers").check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByText(PAY_PROMPT)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  await expect(page.getByText(PAY_PROMPT)).toHaveCount(0);
});
