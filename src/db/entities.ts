import { z } from "zod";

/** Champs communs à toutes les tables (SPEC §4). */
const baseEntity = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archived: z.boolean().optional(),
});

/** Montant en unités mineures : entier sûr, jamais un float. */
const minorAmount = z.number().int().safe();
const positiveMinor = minorAmount.positive();
const currencyCode = z.enum(["MGA", "EUR", "USD"]);
const isoDateTime = z.iso.datetime();

export const settingsSchema = baseEntity.extend({
  baseCurrency: currencyCode,
  monthStartDay: z.number().int().min(1).max(31),
  weekStartDay: z.number().int().min(0).max(6),
  language: z.enum(["fr", "en", "mg"]),
  theme: z.enum(["light", "dark", "system"]),
  numberFormat: z.string().optional(),
  defaultWalletId: z.uuid().optional(),
  autoLockSeconds: z.number().int().min(0).optional(),
  pinHash: z.string().optional(),
  pinSalt: z.string().optional(),
  pinFailures: z.number().int().nonnegative().optional(),
  pinLockedUntil: isoDateTime.optional(),
  hideAmounts: z.boolean().optional(),
  biometricCredentialId: z.string().optional(),
  /** Date de la dernière sauvegarde téléchargée (rappel après 7 jours, SPEC §5.14). */
  lastBackupAt: isoDateTime.optional(),
  /** Touche de zéros du clavier de saisie : « 00 » ou « 000 » (défaut : 000). */
  keypadZeros: z.union([z.literal(2), z.literal(3)]).optional(),
  /** Solde « à aujourd'hui » : ignore les transactions datées dans le futur. */
  ignoreFutureBalance: z.boolean().optional(),
  /** Rappel quotidien de saisie (notification, uniquement quand l'app est ouverte). */
  reminderEnabled: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  /** Jour (AAAA-MM-JJ) du dernier rappel affiché, pour ne le montrer qu'une fois par jour. */
  lastReminderDay: z.string().optional(),
});

export const currencySchema = baseEntity.extend({
  code: currencyCode,
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(4),
  symbolPosition: z.enum(["before", "after"]),
});

export const exchangeRateSchema = baseEntity.extend({
  from: currencyCode,
  to: currencyCode,
  rate: z.number().positive(),
  date: isoDateTime,
});

export const walletSchema = baseEntity.extend({
  name: z.string().min(1),
  icon: z.string(),
  color: z.string(),
  currency: currencyCode,
  initialBalance: minorAmount,
  sortOrder: z.number().int(),
  includeInTotal: z.boolean(),
  group: z.enum(["bank", "cash", "mobile", "savings", "credit_card"]),
});

export const categorySchema = baseEntity.extend({
  name: z.string().min(1),
  kind: z.enum(["expense", "income"]),
  icon: z.string(),
  color: z.string(),
  sortOrder: z.number().int(),
});

export const subcategorySchema = baseEntity.extend({
  categoryId: z.uuid(),
  name: z.string().min(1),
  icon: z.string(),
});

const transactionFields = {
  type: z.enum(["expense", "income", "transfer", "adjustment"]),
  amount: minorAmount,
  currency: currencyCode,
  walletId: z.uuid(),
  toWalletId: z.uuid().optional(),
  toAmount: positiveMinor.optional(),
  fee: z.number().int().nonnegative().optional(),
  categoryId: z.uuid().optional(),
  subcategoryId: z.uuid().optional(),
  memo: z.string(),
  /** Note libre (texte) : les médias restent dans attachmentIds. */
  note: z.string().max(5000).optional(),
  attachmentIds: z.array(z.uuid()),
  recurringId: z.uuid().optional(),
  debtId: z.uuid().optional(),
  goalId: z.uuid().optional(),
};

/** Règles communes aux montants : dépense, revenu et virement sont des montants positifs. */
function checkTransactionRules(
  t: { type: string; amount: number; toWalletId?: string | undefined; walletId: string },
  ctx: z.RefinementCtx,
): void {
  if (t.type !== "adjustment" && t.amount < 0) {
    ctx.addIssue({ code: "custom", path: ["amount"], message: "Montant négatif pour ce type" });
  }
  if (t.type === "transfer") {
    if (!t.toWalletId) {
      ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Virement sans destination" });
    } else if (t.toWalletId === t.walletId) {
      ctx.addIssue({
        code: "custom",
        path: ["toWalletId"],
        message: "Virement vers le même portefeuille",
      });
    }
  }
}

export const transactionSchema = baseEntity
  .extend({
    ...transactionFields,
    date: isoDateTime,
    status: z.enum(["posted", "pending"]),
  })
  .superRefine(checkTransactionRules);

/** Modèle : mêmes champs qu'une transaction, sans date ni statut, plus un nom et une icône. */
export const templateSchema = baseEntity
  .extend({
    ...transactionFields,
    name: z.string().min(1),
    icon: z.string(),
  })
  .superRefine(checkTransactionRules);

export const recurringSchema = baseEntity
  .extend({
    type: transactionFields.type,
    amount: minorAmount,
    currency: currencyCode,
    walletId: z.uuid(),
    toWalletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    subcategoryId: z.uuid().optional(),
    memo: z.string(),
    frequency: z.object({
      unit: z.enum(["day", "week", "month", "year"]),
      interval: z.number().int().min(1),
    }),
    startDate: isoDateTime,
    endDate: isoDateTime.optional(),
    nextDate: isoDateTime,
    /** Index de la prochaine occurrence (0 = première). Évite la dérive des dates (ex. 31 → 28 → 31). */
    occurrenceIndex: z.number().int().nonnegative(),
    autoPost: z.boolean(),
    paused: z.boolean(),
    dayOfMonthRule: z.enum(["same_day", "last_day"]),
  })
  .superRefine(checkTransactionRules);

export const budgetSchema = baseEntity.extend({
  name: z.string().min(1),
  amount: positiveMinor,
  currency: currencyCode,
  period: z.enum(["week", "month", "year", "custom"]),
  startDate: isoDateTime,
  endDate: isoDateTime.optional(),
  categoryIds: z.array(z.uuid()),
  walletIds: z.array(z.uuid()),
  rollover: z.boolean(),
  alertThreshold: z.number().int().min(1).max(100),
});

export const goalSchema = baseEntity.extend({
  name: z.string().min(1),
  icon: z.string(),
  targetAmount: positiveMinor,
  targetDate: isoDateTime.optional(),
  currency: currencyCode,
  walletId: z.uuid().optional(),
});

export const goalTransactionSchema = baseEntity.extend({
  goalId: z.uuid(),
  amount: minorAmount.refine((n) => n !== 0, "Versement nul"),
  date: isoDateTime,
  memo: z.string(),
  transactionId: z.uuid().optional(),
});

export const debtSchema = baseEntity.extend({
  direction: z.enum(["lent", "borrowed"]),
  counterparty: z.string().min(1),
  principal: positiveMinor,
  currency: currencyCode,
  startDate: isoDateTime,
  dueDate: isoDateTime.optional(),
  interestRate: z.number().min(0).optional(),
  notes: z.string(),
});

export const debtPaymentSchema = baseEntity.extend({
  debtId: z.uuid(),
  amount: positiveMinor,
  date: isoDateTime,
  memo: z.string(),
  transactionId: z.uuid().optional(),
});

export const attachmentSchema = baseEntity.extend({
  blob: z.instanceof(Blob),
  mime: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Subcategory = z.infer<typeof subcategorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Recurring = z.infer<typeof recurringSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type GoalTransaction = z.infer<typeof goalTransactionSchema>;
export type Debt = z.infer<typeof debtSchema>;
export type DebtPayment = z.infer<typeof debtPaymentSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;

/** Réconciliation d'un portefeuille (SPEC §5.12) : solde réel saisi, écart, ajustement créé. */
export const reconciliationSchema = baseEntity.extend({
  walletId: z.uuid(),
  date: isoDateTime,
  realBalance: minorAmount,
  computedBalance: minorAmount,
  adjustment: minorAmount,
  transactionId: z.uuid().optional(),
  memo: z.string(),
});

export type Reconciliation = z.infer<typeof reconciliationSchema>;
