import fs from "node:fs";
import path from "node:path";
import { devices, expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { completeOnboardingUi } from "../helpers";

// Cinq parcours de test « persona », approuvés avant exécution. Chaque parcours continue même
// après une difficulté : les constats sont consignés puis rendus dans un rapport joint au test.
//  - bloqué : le parcours ne peut pas être terminé
//  - gêne   : le parcours aboutit mais avec une hésitation ou un problème de mise en page
//  - note   : observation factuelle (valeur affichée, libellé, comportement)

type Severity = "bloqué" | "gêne" | "note";
type Finding = { severity: Severity; step: string; detail: string };

class Journal {
  readonly findings: Finding[] = [];

  constructor(private readonly info: TestInfo) {}

  note(severity: Severity, step: string, detail: string) {
    this.findings.push({ severity, step, detail });
  }

  async step(name: string, fn: () => Promise<void>, page?: Page) {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
      this.note("bloqué", name, msg.slice(0, 240));
      if (page) {
        await this.shot(page, `erreur-${name.replace(/\W+/g, "-").slice(0, 40)}`).catch(() => undefined);
      }
    }
  }

  async shot(page: Page, name: string) {
    const dir = path.join(process.cwd(), "test-results", "personas-shots");
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
  }

  /** Défilement horizontal et zones tactiles de moins de 44 px sur la page courante. */
  async layout(page: Page, where: string) {
    const result = await page.evaluate(() => {
      const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      const small: string[] = [];
      document.querySelectorAll<HTMLElement>("button, a[href]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width <= 1 || r.height <= 1 || cs.visibility === "hidden" || cs.display === "none") {
          return;
        }
        if (r.height < 44 || r.width < 44) {
          const label = (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 32);
          small.push(`« ${label} » (${Math.round(r.width)}×${Math.round(r.height)})`);
        }
      });
      return { overflowX, small };
    });
    if (result.overflowX) this.note("gêne", where, "défilement horizontal de la page");
    if (result.small.length > 0) {
      this.note(
        "gêne",
        where,
        `${result.small.length} zone(s) tactile(s) < 44 px : ${result.small.slice(0, 6).join(", ")}`,
      );
    }
  }

  /** Montants affichés dans le format MGA (ex. 1.500) pour comparer les pages entre elles. */
  async amounts(page: Page, where: string) {
    await page.waitForTimeout(400); // laisse les listes live se remplir
    const text = await page.locator("main").innerText();
    const found = [...new Set(text.match(/[-−]?\d{1,3}(?:\.\d{3})+/g) ?? [])].slice(0, 12);
    this.note("note", where, `montants affichés : ${found.join(" ; ") || "aucun"}`);
  }

  async finish() {
    const report = this.findings.map((f) => `[${f.severity}] ${f.step} — ${f.detail}`).join("\n");
    await this.info.attach("rapport", { body: report || "Aucun constat", contentType: "text/plain" });
    console.log(`\n=== ${this.info.title} ===\n${report || "Aucun constat"}\n`);
    const blocked = this.findings.filter((f) => f.severity === "bloqué");
    expect(blocked.map((f) => `${f.step} : ${f.detail}`), "parcours bloqué").toEqual([]);
  }
}

// Un parcours bloqué doit échouer vite avec un message clair, pas attendre le délai global.
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(20_000);
});

async function keypad(page: Page, digits: string) {
  for (const key of digits) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

async function freshContext(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    isMobile: true,
    baseURL,
  });
  return context;
}

// ---------------------------------------------------------------------------
// 1. Personne âgée peu à l'aise avec le numérique
// ---------------------------------------------------------------------------
test("persona 1 — personne âgée peu à l'aise avec le numérique", async ({ page }, testInfo) => {
  test.setTimeout(5 * 60_000);
  const j = new Journal(testInfo);

  await j.step("ouverture de l'app", async () => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Vos finances deviennent simples !" }),
    ).toBeVisible();
    await j.shot(page, "p1-01-intro");
  });

  await j.step("introduction", async () => {
    await page.getByRole("button", { name: "Commencer" }).click();
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Suivant" }).click();
    }
    const hasSkip = await page.getByRole("button", { name: /Passer|Ignorer/ }).count();
    if (hasSkip === 0) j.note("gêne", "introduction", "aucun bouton « Passer » : il faut lire les 3 écrans");
  });

  await j.step("premier portefeuille", async () => {
    const next = page.getByRole("button", { name: "Suivant" });
    if (await next.isDisabled()) {
      j.note("gêne", "premier portefeuille", "« Suivant » grisé sans explication tant que le nom est vide");
    }
    await page.getByLabel("Nom").fill("Mon argent");
    await next.click();
    await j.shot(page, "p1-02-solde");
  });

  await j.step("solde de départ", async () => {
    j.note("note", "solde de départ", "écran « Solde de départ » : aide sur la valeur à saisir à vérifier");
    await page.getByRole("button", { name: "Terminer" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  });

  await j.step("accueil", async () => {
    await j.layout(page, "Accueil");
    await j.shot(page, "p1-03-accueil");
  });

  await j.step("noter une dépense", async () => {
    const plus = page.getByRole("link", { name: "Nouvelle transaction" });
    const visibleText = await plus.innerText().catch(() => "");
    if (visibleText.trim() === "") {
      j.note("gêne", "bouton +", "le bouton « + » n'a aucun mot visible à côté : seul le symbole indique l'action");
    }
    await plus.click();
    const types = await page.getByRole("radio", { name: /Dépense|Revenu|Virement|Ajustement/ }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? ""));
    j.note("note", "feuille de saisie", `types proposés : ${types.join(" / ") || "aucun trouvé"}`);
    await keypad(page, "2500");
    await j.shot(page, "p1-04-saisie");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByTestId("transaction-list")).toContainText("2.500");
  });

  await j.step("retrouver la dépense", async () => {
    await page.getByRole("link", { name: "Transactions" }).first().click();
    await expect(page.getByTestId("transaction-list")).toContainText("2.500");
    await j.layout(page, "Transactions");
    await j.shot(page, "p1-05-transactions");
  });

  await j.amounts(page, "Transactions");
  await j.finish();
});

// ---------------------------------------------------------------------------
// 2. Jeune actif : plusieurs comptes, virement, abonnement, budget
// ---------------------------------------------------------------------------
test("persona 2 — jeune actif avec plusieurs comptes et abonnements", async ({ page }, testInfo) => {
  test.setTimeout(8 * 60_000);
  const j = new Journal(testInfo);
  await completeOnboardingUi(page, "Compte BNI");

  await j.step("créer le compte mobile money", async () => {
    await page.goto("/plus/wallets/new");
    await page.getByLabel("Nom").fill("Mobile money");
    await page.getByLabel(/Solde initial/).fill("200000");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.goto("/plus/wallets");
    await expect(page.getByText("Mobile money").first()).toBeVisible();
    await j.shot(page, "p2-01-portefeuilles");
  });

  await j.step("virement entre comptes", async () => {
    await page.goto("/transactions/new");
    await page.getByRole("radio", { name: "Virement", exact: true }).click();
    await keypad(page, "50000");
    await page.getByLabel("Vers").selectOption({ label: "Mobile money (MGA)" });
    await j.shot(page, "p2-02-virement");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByTestId("transaction-list")).toContainText("50.000");
  });

  await j.step("soldes après virement", async () => {
    await page.goto("/plus/wallets");
    await page.waitForTimeout(400);
    const shown = await page.getByText("250.000").count();
    if (shown === 0) {
      j.note("gêne", "soldes", "« Mobile money » attendu à 250.000 après virement : valeur absente");
    }
    await j.amounts(page, "Portefeuilles");
  });

  await j.step("abonnement mensuel", async () => {
    await page.goto("/plus/recurring/new");
    await page.getByLabel(/Montant/).fill("65000");
    await page.getByLabel("Mémo").fill("Abonnement internet");
    await page.getByLabel("Premier passage").fill("2026-11-01T09:00");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Récurrences" })).toBeVisible();
  });

  await j.step("modifier l'abonnement", async () => {
    await page.getByRole("link", { name: /Abonnement internet/ }).click();
    await page.getByRole("link", { name: "Modifier" }).click();
    await page.getByLabel("Mémo").fill("Internet fibre");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Internet fibre").first()).toBeVisible();
    await j.shot(page, "p2-03-recurrence-modifiee");
  });

  await j.step("mettre en pause", async () => {
    await page.getByRole("button", { name: "Mettre en pause" }).click();
    await expect(page.getByText("en pause").first()).toBeVisible();
  });

  await j.step("budget courses", async () => {
    await page.goto("/budgets/new");
    await page.getByLabel("Nom").fill("Courses");
    await page.getByLabel(/^Montant/).fill("300000");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Courses").first()).toBeVisible();
    await j.shot(page, "p2-04-budget");
  });

  await j.step("accueil", async () => {
    await page.goto("/");
    await j.layout(page, "Accueil");
    await j.amounts(page, "Accueil");
  });

  await j.finish();
});

// ---------------------------------------------------------------------------
// 3. Petit commerçant : import CSV Excel, cohérence des totaux
// ---------------------------------------------------------------------------
test("persona 3 — petit commerçant : import CSV et cohérence des totaux", async ({ page }, testInfo) => {
  test.setTimeout(6 * 60_000);
  const j = new Journal(testInfo);
  await completeOnboardingUi(page, "Compte BNI");

  const csv = [
    "Date,Type,Category,Amount,Currency,Memo,Wallet",
    '"02/11/2026, 08:15",income,Ventes,350000,MGA,Ventes du matin,Compte BNI',
    '"02/11/2026, 12:40",expense,Transport,-12000.00,MGA,Taxi-be,Compte BNI',
    '"03/11/2026, 17:00",adjustment,,-5000,MGA,Écart de caisse,Compte BNI',
    '"03/11/2026, 18:00",income,Ventes,180000.00,MGA,Ventes du soir,Compte BNI',
  ].join("\n");

  await j.step("importer le CSV", async () => {
    await page.goto("/plus/import");
    await page.getByLabel("Choisir un fichier CSV").setInputFiles({
      name: "ventes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await page.getByRole("button", { name: "Aperçu" }).click();
    await j.shot(page, "p3-01-apercu");
    const preview = await page.getByRole("status").or(page.locator("body")).innerText();
    const match = preview.match(/\d+ transaction\(s\) à importer[^\n]*/);
    j.note("note", "aperçu", match ? match[0] : "texte d'aperçu non trouvé");
    await page.getByRole("button", { name: /Importer \d+ transaction/ }).click();
    await expect(page.getByRole("status")).toContainText("créée");
    j.note("note", "import", (await page.getByRole("status").innerText()).trim());
  });

  await j.step("totaux de l'accueil", async () => {
    await page.goto("/");
    await j.layout(page, "Accueil");
    // Attendu : 350 000 + 180 000 − 12 000 − 5 000 = 513 000 (si l'ajustement compte dans le net).
    const shown = await page.getByText("513.000").count();
    if (shown === 0) {
      j.note("gêne", "accueil", "net attendu 513.000 non trouvé : vérifier si l'ajustement est compté");
    }
    await j.amounts(page, "Accueil");
    await j.shot(page, "p3-02-accueil");
  });

  await j.step("cohérence Transactions, Analyses, Calendrier", async () => {
    await page.goto("/transactions");
    await j.amounts(page, "Transactions");
    await j.shot(page, "p3-03-transactions");
    await page.goto("/stats");
    await j.amounts(page, "Analyses");
    await page.goto("/calendar");
    await j.amounts(page, "Calendrier");
  });

  await j.finish();
});

// ---------------------------------------------------------------------------
// 4. Salarié payé vers le 28 : budgets, périodes, « Ce qui vous reste »
// ---------------------------------------------------------------------------
test("persona 4 — salarié payé vers le 28 : budgets et périodes", async ({ page }, testInfo) => {
  test.setTimeout(6 * 60_000);
  const j = new Journal(testInfo);
  await completeOnboardingUi(page, "Compte BNI");

  // Dates au format attendu par l'import (MM/DD) : 11/01/2026 = 1er novembre 2026.
  const csv = [
    "Date,Type,Category,Amount,Currency,Memo,Wallet",
    '"11/01/2026, 09:00",income,Salaire,1200000,MGA,Salaire,Compte BNI',
    '"11/02/2026, 12:00",expense,Alimentation,250000,MGA,Courses semaine,Compte BNI',
    '"11/03/2026, 12:00",expense,Transport,80000,MGA,Carburant,Compte BNI',
    '"11/04/2026, 09:00",expense,Loyer,500000,MGA,Loyer novembre,Compte BNI',
  ].join("\n");

  await j.step("importer les opérations du mois", async () => {
    await page.goto("/plus/import");
    await page.getByLabel("Choisir un fichier CSV").setInputFiles({
      name: "novembre.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
    await page.getByRole("button", { name: "Aperçu" }).click();
    await page.getByRole("button", { name: /Importer \d+ transaction/ }).click();
    await expect(page.getByRole("status")).toContainText("créée");
  });

  await j.step("créer le budget alimentation", async () => {
    await page.goto("/budgets/new");
    await page.getByLabel("Nom").fill("Alimentation");
    await page.getByLabel(/^Montant/).fill("300000");
    await page.getByLabel(/Alimentation/).first().check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Alimentation").first()).toBeVisible();
    await j.shot(page, "p4-01-budgets");
  });

  await j.step("budgets : statut affiché", async () => {
    await page.goto("/budgets");
    await expect(page.getByText("Alimentation").first()).toBeVisible();
    await j.layout(page, "Budgets");
    const text = await page.locator("main").innerText();
    j.note("note", "budgets", text.replace(/\s+/g, " ").slice(0, 260));
  });

  await j.step("ce qui vous reste", async () => {
    await page.goto("/");
    // Attendu : 1 200 000 − 250 000 − 80 000 − 500 000 = 370 000.
    await page.waitForTimeout(400);
    const shown = await page.getByText("370.000").count();
    if (shown === 0) j.note("gêne", "accueil", "« Ce qui vous reste » attendu 370.000 non trouvé");
    await j.amounts(page, "Accueil");
    await j.layout(page, "Accueil");
    await j.shot(page, "p4-02-accueil");
  });

  await j.step("analyses et période", async () => {
    await page.goto("/stats");
    await j.layout(page, "Analyses");
    await j.shot(page, "p4-03-analyses");
    const prev = page.getByRole("button", { name: /précédent/i }).first();
    if (await prev.isVisible()) {
      await prev.click();
      j.note("note", "analyses", `période précédente : ${(await page.locator("main").innerText()).slice(0, 120).replace(/\s+/g, " ")}`);
    } else {
      j.note("gêne", "analyses", "aucun bouton « précédent » trouvé pour changer de période");
    }
    j.note("gêne", "réglage", "le jour de début de mois est fixé à 1 : un salaire du 28 reste dans son mois civil");
  });

  await j.finish();
});

// ---------------------------------------------------------------------------
// 5. Utilisateur qui change de téléphone : sauvegarde, restauration, hors ligne, réinitialisation
// ---------------------------------------------------------------------------
test("persona 5 — changement de téléphone : sauvegarde, restauration, hors ligne", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(8 * 60_000);
  const j = new Journal(testInfo);
  const password = "motdepasse123";

  await j.step("saisir une dépense sur l'ancien téléphone", async () => {
    await completeOnboardingUi(page, "Compte BNI");
    await page.getByRole("link", { name: "Nouvelle transaction" }).click();
    await keypad(page, "45000");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByTestId("transaction-list")).toContainText("45.000");
  });

  let backupPath = "";
  await j.step("sauvegarde chiffrée", async () => {
    await page.goto("/plus/backup");
    await page.getByLabel(/Mot de passe de chiffrement/).fill(password);
    await j.layout(page, "Sauvegarde");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Télécharger la sauvegarde" }).click(),
    ]);
    backupPath = await download.path();
    j.note("note", "sauvegarde", `fichier : ${download.suggestedFilename()}`);
    const shareVisible = await page.getByRole("button", { name: /Partager vers/ }).isVisible().catch(() => false);
    j.note("note", "partage", shareVisible ? "bouton Partager visible" : "bouton Partager absent sur ce navigateur (test non couvert)");
    await j.shot(page, "p5-01-sauvegarde");
  });

  // Nouveau téléphone : un navigateur vierge, sans aucune donnée.
  const phone = await freshContext(browser, testInfo.project.use.baseURL as string | undefined);
  phone.setDefaultTimeout(20_000);
  const next = await phone.newPage();
  next.setDefaultTimeout(20_000);

  await j.step("restauration sur le nouveau téléphone", async () => {
    await next.goto("/");
    await next.getByRole("link", { name: "J'ai déjà une sauvegarde" }).click();
    await next.getByLabel("Choisir un fichier de sauvegarde").setInputFiles(backupPath);
    await next.getByLabel("Mot de passe du fichier").fill(password);
    await next.getByRole("button", { name: "Déchiffrer" }).click();
    await next.getByRole("button", { name: "Restaurer", exact: true }).click();
    await next.waitForTimeout(800);
    const statusText = await next
      .getByRole("status")
      .allInnerTexts()
      .then((t) => t.join(" | "))
      .catch(() => "(aucun statut)");
    if (!statusText.includes("Restauration terminée")) {
      throw new Error(`message après restauration : « ${statusText.replace(/\s+/g, " ").slice(0, 160)} »`);
    }
    await next.getByRole("link", { name: "Aller à l'accueil" }).click();
    await expect(next.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
    await next.goto("/transactions");
    await next.waitForTimeout(800);
    const listText = await next
      .getByTestId("transaction-list")
      .innerText()
      .catch(() => "(liste absente)");
    if (!listText.includes("45.000")) {
      throw new Error(`liste après restauration sans 45.000 : « ${listText.replace(/\s+/g, " ").slice(0, 160)} »`);
    }
    await j.shot(next, "p5-02-restaure");
  }, next);

  await j.step("hors ligne après restauration", async () => {
    // Même précaution que le test hors ligne existant : attendre que le service worker contrôle la page.
    await next.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await next.reload();
    await next.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
      timeout: 30_000,
    });
    await next.reload();
    await phone.setOffline(true);
    for (const [path, heading] of [
      ["/transactions", "Transactions"],
      ["/stats", "Analyses"],
      ["/plus/backup", "Sauvegarde et restauration"],
    ] as const) {
      await next.goto(path);
      await expect(next.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 15_000 });
    }
    await j.shot(next, "p5-03-hors-ligne");
  }, next);

  await j.step("réinitialisation du compte", async () => {
    await next.goto("/plus");
    // 1. Ouvrir la ligne « Réinitialiser le compte ». 2. Son bouton rouge « Tout supprimer ».
    // 3. Confirmer dans la feuille (dialogue).
    await next.getByRole("button", { name: "Réinitialiser le compte", exact: true }).click();
    await next.getByRole("button", { name: "Tout supprimer", exact: true }).first().click();
    await next.getByRole("dialog").getByRole("button", { name: "Tout supprimer", exact: true }).click();
    await expect(
      next.getByRole("heading", { level: 1, name: "Vos finances deviennent simples !" }),
    ).toBeVisible({ timeout: 15_000 });
    await j.shot(next, "p5-04-reinitialise");
  }, next);

  await phone.close();
  await j.finish();
});
