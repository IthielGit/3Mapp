import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

test("récurrence passée : rattrapée à l’ouverture, puis validée depuis « En attente »", async ({
  page,
}) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Récurrences et modèles" }).click();
  await page.getByRole("link", { name: "Ajouter" }).click();

  await page.getByLabel(/Montant/).fill("150000");
  await page.getByLabel("Mémo").fill("Loyer");
  await page.getByLabel("Premier passage").fill("2026-01-05T09:00");
  await page.getByLabel("Créer directement comme validée (sinon en attente)").uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Récurrences" })).toBeVisible();

  // Rechargement : le rattrapage à l'ouverture crée les occurrences échues depuis janvier.
  await page.reload();
  await expect(page.getByRole("heading", { name: /En attente \(\d+\)/ })).toBeVisible();

  await expect(page.getByRole("button", { name: "Valider" }).first()).toBeVisible();
  const validateButtons = page.getByRole("button", { name: "Valider" });
  const before = await validateButtons.count();
  expect(before).toBeGreaterThan(1);

  await validateButtons.first().click();
  await expect(validateButtons).toHaveCount(before - 1);
});
