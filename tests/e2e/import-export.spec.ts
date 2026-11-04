import { expect, test } from "@playwright/test";
import { completeOnboardingUi } from "./helpers";

const CSV = [
  "Date,Type,Category,Amount,Currency,Memo,Wallet",
  '"01/10/2026, 09:30",income,Salaire,1200000,MGA,Paie,Compte BNI',
  '"01/11/2026, 12:00",expense,Alimentation,45000,MGA,Riz,Compte BNI',
].join("\n");

test("import CSV puis second import identique : doublons détectés", async ({ page }) => {
  await completeOnboardingUi(page, "Compte BNI");
  await page.getByRole("link", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Import / Export" }).click();

  await page.getByLabel("Choisir un fichier CSV").setInputFiles({
    name: "export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf8"),
  });
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(page.getByText("2 transaction(s) à importer, 0 doublon(s)")).toBeVisible();
  await page.getByRole("button", { name: "Importer 2 transaction(s)" }).click();
  await expect(page.getByRole("status")).toContainText("2 créée(s)");

  await page.getByLabel("Choisir un fichier CSV").setInputFiles({
    name: "export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf8"),
  });
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(page.getByText("0 transaction(s) à importer, 2 doublon(s)")).toBeVisible();
});
