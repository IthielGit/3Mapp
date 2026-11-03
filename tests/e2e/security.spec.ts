import { expect, test, type Page } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

const PIN = "482615";

async function typePin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

async function createPin(page: Page) {
  await completeOnboardingUi(page, "Compte BNI");
  await page.goto("/plus/security");
  await page.getByLabel("Créer un PIN (4 à 6 chiffres)").fill(PIN);
  await page.getByRole("button", { name: "Créer le PIN" }).click();
  await expect(page.getByText("Enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Déverrouiller" })).toBeVisible();
}

test("PIN : trois mauvais essais déclenchent la temporisation", async ({ page }) => {
  await createPin(page);

  // Un PIN de 6 chiffres se valide dès la saisie : trois essais faux.
  for (let i = 0; i < 3; i++) {
    await typePin(page, "111111");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.waitForTimeout(600); // laisse la base traiter l’essai avant le suivant
  }
  await expect(page.getByRole("alert")).toContainText("Trop d'essais");
  await expect(page.getByRole("button", { name: "1", exact: true })).toBeDisabled();
});

test("PIN : le bon code ouvre l'application", async ({ page }) => {
  await createPin(page);
  await typePin(page, PIN);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Sécurité" })).toBeVisible();
});
