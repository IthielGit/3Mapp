import { expect, test, type Page } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

const CARD_TITLE = "Quand touchez-vous votre paie ?";

test("sans paie définie, la carte demande le jour et le revenu, puis disparaît", async ({ page }) => {
  await completeOnboardingUi(page);

  await expect(page.getByText(CARD_TITLE)).toBeVisible();
  await page.getByLabel("Salaire à date fixe").check();
  await page.getByLabel("Jour du mois").selectOption("28");
  await page.getByLabel("Revenu concerné").selectOption({ label: "Salaire" });
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByText(CARD_TITLE)).toHaveCount(0);
});

test("revenus irréguliers : la question ne revient plus sur l'accueil", async ({ page }) => {
  await completeOnboardingUi(page);

  await page.getByLabel("Revenus irréguliers").check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

  await expect(page.getByText(CARD_TITLE)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  await expect(page.getByText(CARD_TITLE)).toHaveCount(0);
});

test("onboarding : répondre à la question de paie évite la carte d'accueil", async ({ page }: { page: Page }) => {
  await page.goto("/");
  await page.getByRole("heading", { level: 1, name: "Vos finances deviennent simples !" }).waitFor();
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Nom").fill("Compte BNI");
  await page.getByLabel("Salaire à date fixe").check();
  await page.getByLabel("Jour du mois").selectOption("25");
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("heading", { level: 1, name: "Accueil" }).waitFor();

  await expect(page.getByText(CARD_TITLE)).toHaveCount(0);
});
