import { db as defaultDb, type AppDatabase } from "../../db/database";
import { currencySchema, settingsSchema, type Wallet } from "../../db/entities";
import { createRepository } from "../../db/repositories";
import { restoreDefaultCategories } from "../categories/category-service";
import { defaultCategoryId } from "../categories/defaults";
import { createWallet } from "../wallets/wallet-service";
import { CURRENCIES, type CurrencyCode, type Minor } from "../../lib/money";
import type { PayChoice } from "../cycle/PaySetupForm";

export interface OnboardingInput {
  language: "fr" | "en";
  baseCurrency: CurrencyCode;
  /** Réponse à la question de paie ; absente si l’utilisateur n’a pas répondu (la carte d’accueil la reposera). */
  pay?: PayChoice;
  wallet: {
    name: string;
    icon: string;
    color: string;
    group: Wallet["group"];
    currency: CurrencyCode;
    initialBalance: Minor;
  };
}

export async function isOnboarded(database: AppDatabase = defaultDb): Promise<boolean> {
  return (await database.settings.count()) > 0;
}

/**
 * Premier lancement : réglages, devises connues, premier portefeuille et jeu de catégories par défaut.
 * Tout est écrit dans une seule transaction.
 */
export async function completeOnboarding(
  input: OnboardingInput,
  database: AppDatabase = defaultDb,
): Promise<void> {
  if (await isOnboarded(database)) throw new Error("Onboarding déjà effectué");

  await database.transaction(
    "rw",
    [
      database.settings,
      database.currencies,
      database.wallets,
      database.categories,
      database.subcategories,
    ],
    async () => {
      await createRepository(database.settings, settingsSchema).create({
        baseCurrency: input.baseCurrency,
        monthStartDay: input.pay?.mode === "fixed" ? input.pay.day : 1,
        ...(input.pay ? { payMode: input.pay.mode } : {}),
        ignoreFutureBalance: true,
        weekStartDay: 1,
        language: input.language,
        theme: "system",
      });

      const currencies = createRepository(database.currencies, currencySchema);
      for (const def of Object.values(CURRENCIES)) {
        await currencies.create({
          code: def.code,
          name: def.name,
          symbol: def.symbol,
          decimals: def.decimals,
          symbolPosition: def.symbolPosition,
        });
      }

      const wallet = await createWallet(
        { ...input.wallet, includeInTotal: true, archived: false },
        database,
      );
      await database.settings.toCollection().modify((s) => {
        s.defaultWalletId = wallet.id;
      });

      await restoreDefaultCategories(database);
      const salaryId = defaultCategoryId("income", "Salaire");
      // Paie à date fixe : la catégorie « Salaire » par défaut est celle de la paie.
      if (input.pay?.mode === "fixed") {
        await database.settings.toCollection().modify((s) => {
          s.payIncomeCategoryId = salaryId;
        });
      }
    },
  );
}
