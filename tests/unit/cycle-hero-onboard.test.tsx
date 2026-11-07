import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { createTransaction } from "../../src/features/transactions/transaction-service";
import { CycleHero } from "../../src/features/home/CycleHero";
import { useHomeData } from "../../src/features/home/useHomeData";

function Hero() {
  const data = useHomeData();
  return data.loaded ? <CycleHero {...data} /> : null;
}

function renderHero() {
  return render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  );
}

async function onboard(initialBalance: number) {
  await completeOnboarding(
    {
      language: "fr",
      baseCurrency: "MGA",
      wallet: { name: "Compte", icon: "🏦", color: "#0f766e", group: "bank", currency: "MGA", initialBalance },
    },
    db,
  );
}

async function addIncome(hoursAgo: number) {
  const wallet = await db.wallets.toCollection().first();
  const category = (await db.categories.toArray()).find((c) => c.kind === "income");
  if (!wallet || !category) throw new Error("données de départ absentes");
  await createTransaction(
    {
      type: "income",
      amount: 50_000_000,
      walletId: wallet.id,
      categoryId: category.id,
      memo: "",
      attachmentIds: [],
      date: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
      status: "posted",
    },
    db,
  );
}

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("carte du mois : premier lancement", () => {
  it("comptes à 0, rien de saisi : une seule étape, sans « 0 Ar » ni question de paie", async () => {
    await onboard(0);
    renderHero();
    expect(await screen.findByText(/indiquez combien il y a sur vos comptes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renseigner les soldes de départ" })).toBeInTheDocument();
    expect(screen.queryByText(/Reste du mois/)).toBeNull();
    expect(screen.queryByText("Quand touchez-vous votre paie ?")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("solde connu, rien de saisi : la première saisie", async () => {
    await onboard(1_000_000);
    renderHero();
    expect(await screen.findByRole("link", { name: "Ajouter une transaction" })).toBeInTheDocument();
    expect(screen.queryByText(/Reste du mois/)).toBeNull();
  });

  it("« Non » est mémorisé, puis la ligne de paie ouvre le formulaire dans une feuille, avec annulation", async () => {
    await onboard(1_000_000);
    // Une suggestion demande un revenu de la même catégorie sur deux mois.
    await addIncome(35 * 24);
    await addIncome(1);
    renderHero();

    fireEvent.click(await screen.findByRole("button", { name: "Non" }));
    await waitFor(async () =>
      expect((await db.settings.toCollection().first())?.paySuggestionDismissedAt).toBeDefined(),
    );
    expect(await screen.findByText("Quand touchez-vous votre paie ?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Non" })).toBeNull();
    // Le formulaire n'est plus sur la carte.
    expect(screen.queryByRole("radio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Répondre" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByLabelText("Revenus irréguliers"));
    fireEvent.click(within(sheet).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await db.settings.toCollection().first())?.payMode).toBe("irregular"));

    fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));
    await waitFor(async () => expect((await db.settings.toCollection().first())?.payMode).toBeUndefined());
    expect(await screen.findByRole("button", { name: "Répondre" })).toBeInTheDocument();
  }, 20_000);

  it("« Oui » enregistre la paie et propose « Annuler »", async () => {
    await onboard(1_000_000);
    // Une suggestion demande un revenu de la même catégorie sur deux mois.
    await addIncome(35 * 24);
    await addIncome(1);
    renderHero();

    fireEvent.click(await screen.findByRole("button", { name: "Oui" }));
    await waitFor(async () =>
      expect((await db.settings.toCollection().first())?.payIncomeCategoryId).toBeDefined(),
    );
    expect(await screen.findByText(/est maintenant votre paie/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(async () =>
      expect((await db.settings.toCollection().first())?.payIncomeCategoryId).toBeUndefined(),
    );
    expect(await screen.findByRole("button", { name: "Oui" })).toBeInTheDocument();
  }, 20_000);
});
