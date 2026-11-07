import { afterEach, describe, expect, it } from "vitest";
import {
  homeNextStep,
  payAnsweredFrom,
  suggestionStillAsked,
  type HomeStepFacts,
  type HomeStepWallet,
} from "../../src/domain/homeNextStep";
import { AppDatabase } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { updatePreferences } from "../../src/features/settings/preferences-service";
import { stripDeviceFields } from "../../src/domain/sync";

const bank = (initialBalance: number, extra: Partial<HomeStepWallet> = {}): HomeStepWallet => ({
  initialBalance,
  includeInTotal: true,
  group: "bank",
  ...extra,
});

const facts = (patch: Partial<HomeStepFacts>): HomeStepFacts => ({
  wallets: [bank(0)],
  transactionCount: 0,
  ...patch,
});

describe("accueil : une étape à la fois", () => {
  it("comptes à 0 et rien de saisi : soldes de départ", () => {
    expect(homeNextStep(facts({}))).toBe("startBalance");
  });

  it("aucun compte compté : soldes de départ aussi", () => {
    expect(homeNextStep(facts({ wallets: [] }))).toBe("startBalance");
  });

  it("l'épargne, les comptes exclus et archivés ne comptent pas comme solde de départ", () => {
    const wallets = [
      bank(0),
      bank(50_000, { group: "savings" }),
      bank(50_000, { includeInTotal: false }),
      bank(50_000, { archived: true }),
    ];
    expect(homeNextStep(facts({ wallets }))).toBe("startBalance");
  });

  it("un solde de départ, rien de saisi : première saisie", () => {
    expect(homeNextStep(facts({ wallets: [bank(0), bank(120_000)] }))).toBe("firstEntry");
  });

  it("des transactions, paie sans réponse ni suggestion : question de paie", () => {
    expect(homeNextStep(facts({ transactionCount: 3 }))).toBe("pay");
  });

  it("des transactions, suggestion de paie jamais refusée : « C'est votre paie ? »", () => {
    expect(
      homeNextStep(facts({ transactionCount: 3, suggestedPayDate: "2026-10-28T09:00:00.000Z" })),
    ).toBe("paySuggestion");
  });

  it("suggestion refusée : la ligne de paie remplace la question", () => {
    expect(
      homeNextStep(
        facts({
          transactionCount: 3,
          suggestedPayDate: "2026-10-28T09:00:00.000Z",
          paySuggestionDismissedAt: "2026-11-02T10:00:00.000Z",
        }),
      ),
    ).toBe("pay");
  });

  it("un revenu plus récent que le refus est proposé à nouveau", () => {
    expect(
      homeNextStep(
        facts({
          transactionCount: 4,
          suggestedPayDate: "2026-11-28T09:00:00.000Z",
          paySuggestionDismissedAt: "2026-11-02T10:00:00.000Z",
        }),
      ),
    ).toBe("paySuggestion");
  });

  it("paie réglée (revenu choisi, irrégulier ou sans paie) : plus d'étape", () => {
    for (const answer of [
      { payIncomeCategoryId: "c", payMode: "fixed" as const },
      { payMode: "irregular" as const },
      { payMode: "none" as const },
    ]) {
      expect(homeNextStep(facts({ transactionCount: 1, ...answer }))).toBe("none");
    }
  });

  it("jour fixe sans revenu choisi : la question reste posée", () => {
    expect(payAnsweredFrom({ payMode: "fixed" })).toBe(false);
    expect(homeNextStep(facts({ transactionCount: 1, payMode: "fixed" }))).toBe("pay");
  });

  it("les premières étapes passent avant la paie, même sans réponse", () => {
    expect(homeNextStep(facts({ suggestedPayDate: "2026-10-28T09:00:00.000Z" }))).toBe("startBalance");
  });
});

describe("refus de la suggestion", () => {
  it("jamais refusée : posée", () => {
    expect(suggestionStillAsked("2026-10-28T09:00:00.000Z", undefined)).toBe(true);
  });
  it("même instant ou plus ancien : plus posée", () => {
    expect(suggestionStillAsked("2026-10-28T09:00:00.000Z", "2026-10-28T09:00:00.000Z")).toBe(false);
  });
  it("date illisible : traitée comme refusée", () => {
    expect(suggestionStillAsked("??", "2026-10-28T09:00:00.000Z")).toBe(false);
  });
});

describe("refus enregistré dans les réglages", () => {
  let db: AppDatabase | undefined;
  afterEach(async () => {
    await db?.delete();
  });

  it("le refus est mémorisé, envoyé avec les réglages synchronisés, et annulable", async () => {
    db = new AppDatabase(`test-${crypto.randomUUID()}`);
    await completeOnboarding(
      {
        language: "fr",
        baseCurrency: "MGA",
        wallet: { name: "Compte", icon: "🏦", color: "#000000", group: "bank", currency: "MGA", initialBalance: 0 },
      },
      db,
    );
    const at = "2026-11-07T08:00:00.000Z";
    const saved = await updatePreferences({ paySuggestionDismissedAt: at }, db);
    expect(saved.paySuggestionDismissedAt).toBe(at);
    expect((await db.settings.toCollection().first())?.paySuggestionDismissedAt).toBe(at);
    expect(stripDeviceFields(saved).paySuggestionDismissedAt).toBe(at);

    // « Annuler » après « Oui » : les anciennes valeurs (absentes) sont remises.
    await updatePreferences({ payIncomeCategoryId: crypto.randomUUID(), payMode: "fixed" }, db);
    const undone = await updatePreferences({ payIncomeCategoryId: undefined, payMode: undefined }, db);
    expect(undone.payIncomeCategoryId).toBeUndefined();
    expect(undone.payMode).toBeUndefined();
  });

  it("une date invalide est refusée", async () => {
    db = new AppDatabase(`test-${crypto.randomUUID()}`);
    await completeOnboarding(
      {
        language: "fr",
        baseCurrency: "MGA",
        wallet: { name: "Compte", icon: "🏦", color: "#000000", group: "bank", currency: "MGA", initialBalance: 0 },
      },
      db,
    );
    await expect(updatePreferences({ paySuggestionDismissedAt: "hier" }, db)).rejects.toThrow();
  });
});
