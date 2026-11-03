import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { createCategory } from "../../src/features/categories/category-service";
import {
  createRecurring,
  generateDueOccurrences,
  ignorePending,
  postponePending,
  setRecurringPaused,
  validatePending,
} from "../../src/features/recurring/recurring-service";
import {
  createTemplate,
  draftFromTemplate,
  saveTransactionAsTemplate,
} from "../../src/features/transactions/template-service";
import { createTransaction } from "../../src/features/transactions/transaction-service";
import { createWallet } from "../../src/features/wallets/wallet-service";

let db: AppDatabase;

beforeEach(() => {
  db = new AppDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

async function setup() {
  const wallet = await createWallet(
    {
      name: "Banque",
      icon: "🏦",
      color: "#000000",
      group: "bank",
      currency: "MGA",
      initialBalance: 0,
      includeInTotal: true,
      archived: false,
    },
    db,
  );
  const rent = await createCategory(
    { name: "Loyer", kind: "expense", icon: "🏠", color: "#000000", archived: false },
    db,
  );
  return { wallet, rent };
}

const START = new Date(2026, 0, 1, 9).toISOString();
const NOW = new Date(2026, 3, 15, 12); // 15 avril 2026 : janvier à avril sont échus

describe("rattrapage des récurrences (SPEC §5.7)", () => {
  it("application fermée 3 mois : les occurrences manquantes sont créées une seule fois", async () => {
    const { wallet, rent } = await setup();
    await createRecurring(
      {
        draft: {
          type: "expense",
          amount: 500000,
          walletId: wallet.id,
          categoryId: rent.id,
          memo: "Loyer",
          attachmentIds: [],
        },
        frequency: { unit: "month", interval: 1 },
        startDate: START,
        dayOfMonthRule: "same_day",
        autoPost: true,
      },
      db,
    );

    expect(await generateDueOccurrences(NOW, db)).toBe(4);
    expect(await generateDueOccurrences(NOW, db)).toBe(0);
    expect(await db.transactions.count()).toBe(4);
    expect((await db.transactions.toArray()).every((t) => t.status === "posted")).toBe(true);
  });

  it("autoPost désactivé : les occurrences arrivent en attente", async () => {
    const { wallet } = await setup();
    await createRecurring(
      {
        draft: {
          type: "income",
          amount: 1000000,
          walletId: wallet.id,
          memo: "Salaire",
          attachmentIds: [],
        },
        frequency: { unit: "month", interval: 1 },
        startDate: START,
        dayOfMonthRule: "same_day",
        autoPost: false,
      },
      db,
    );
    await generateDueOccurrences(NOW, db);
    expect((await db.transactions.toArray()).every((t) => t.status === "pending")).toBe(true);
  });

  it("une récurrence en pause ne génère rien ; à la reprise, pas de rafale", async () => {
    const { wallet } = await setup();
    const r = await createRecurring(
      {
        draft: {
          type: "expense",
          amount: 1000,
          walletId: wallet.id,
          memo: "Abonnement",
          attachmentIds: [],
        },
        frequency: { unit: "month", interval: 1 },
        startDate: START,
        dayOfMonthRule: "same_day",
        autoPost: true,
      },
      db,
    );
    await setRecurringPaused(r.id, true, db);
    expect(await generateDueOccurrences(NOW, db)).toBe(0);

    await setRecurringPaused(r.id, false, db, NOW);
    expect(await generateDueOccurrences(NOW, db)).toBe(0); // les mois écoulés pendant la pause sont ignorés
    const later = new Date(2026, 4, 20);
    expect(await generateDueOccurrences(later, db)).toBe(1); // seule l'occurrence de mai est créée
  });

  it("un 31 janvier se répète aux bonnes dates (pas de dérive)", async () => {
    const { wallet } = await setup();
    await createRecurring(
      {
        draft: {
          type: "expense",
          amount: 1000,
          walletId: wallet.id,
          memo: "Fin de mois",
          attachmentIds: [],
        },
        frequency: { unit: "month", interval: 1 },
        startDate: new Date(2026, 0, 31, 9).toISOString(),
        dayOfMonthRule: "same_day",
        autoPost: true,
      },
      db,
    );
    await generateDueOccurrences(new Date(2026, 2, 31, 23), db);
    const dates = (await db.transactions.toArray())
      .map((t) => new Date(t.date).getDate())
      .sort((a, b) => a - b);
    expect(dates).toEqual([28, 31, 31]);
  });
});

describe("actions sur les transactions en attente", () => {
  async function pendingOne() {
    const { wallet } = await setup();
    await createRecurring(
      {
        draft: {
          type: "expense",
          amount: 1000,
          walletId: wallet.id,
          memo: "Test",
          attachmentIds: [],
        },
        frequency: { unit: "month", interval: 1 },
        startDate: START,
        dayOfMonthRule: "same_day",
        autoPost: false,
      },
      db,
    );
    await generateDueOccurrences(NOW, db);
    const first = (await db.transactions.toArray()).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!first) throw new Error("aucune occurrence");
    return first;
  }

  it("valider rend la transaction réelle", async () => {
    const tx = await pendingOne();
    await validatePending(tx.id, db);
    expect((await db.transactions.get(tx.id))?.status).toBe("posted");
  });

  it("reporter avance la date d’un jour", async () => {
    const tx = await pendingOne();
    await postponePending(tx.id, db);
    const after = await db.transactions.get(tx.id);
    expect(after).toBeDefined();
    expect(new Date(after?.date ?? "").getTime() - new Date(tx.date).getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it("ignorer supprime l’occurrence sans en recréer une", async () => {
    const tx = await pendingOne();
    await ignorePending(tx.id, db);
    expect(await db.transactions.get(tx.id)).toBeUndefined();
    expect(await generateDueOccurrences(NOW, db)).toBe(0);
  });
});

describe("modèles (SPEC §5.6)", () => {
  it("créer un modèle depuis une transaction existante et le réutiliser", async () => {
    const { wallet, rent } = await setup();
    const tx = await createTransaction(
      {
        type: "expense",
        amount: 500000,
        walletId: wallet.id,
        categoryId: rent.id,
        memo: "Loyer",
        attachmentIds: [],
        date: START,
        status: "posted",
      },
      db,
    );
    const template = await saveTransactionAsTemplate(tx.id, "Loyer mensuel", "🏠", db);
    expect(template.name).toBe("Loyer mensuel");

    const draft = draftFromTemplate(template);
    expect(draft.amount).toBe(500000);
    expect(draft.categoryId).toBe(rent.id);
    expect(draft.status).toBe("posted");
  });

  it("un nom vide est refusé", async () => {
    const { wallet } = await setup();
    await expect(
      createTemplate(
        " ",
        "🏠",
        { type: "expense", amount: 100, walletId: wallet.id, memo: "", attachmentIds: [] },
        db,
      ),
    ).rejects.toThrow();
  });
});
