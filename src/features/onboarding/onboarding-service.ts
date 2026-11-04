import { db as defaultDb, type AppDatabase } from "../../db/database";
import { currencySchema, settingsSchema, type Wallet } from "../../db/entities";
import { createRepository } from "../../db/repositories";
import { createCategory } from "../categories/category-service";
import { DEFAULT_CATEGORIES } from "../categories/defaults";
import { createWallet } from "../wallets/wallet-service";
import { CURRENCIES, type CurrencyCode, type Minor } from "../../lib/money";

export interface OnboardingInput {
  language: "fr" | "en" | "mg";
  baseCurrency: CurrencyCode;
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
        monthStartDay: 1,
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

      for (const category of DEFAULT_CATEGORIES) {
        await createCategory({ ...category, archived: false }, database);
      }
    },
  );
}
