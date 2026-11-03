import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import {
  recurringSchema,
  transactionSchema,
  type Recurring,
  type Transaction,
} from "../../db/entities";
import {
  dueOccurrences,
  indexAfter,
  occurrenceDate,
  type DayRule,
  type Frequency,
} from "../../domain/recurrence";
import { validateDraft, type TransactionDraft } from "../transactions/transaction-service";

export interface RecurringInput {
  draft: Omit<TransactionDraft, "date" | "status">;
  frequency: Frequency;
  startDate: string;
  endDate?: string | undefined;
  dayOfMonthRule: DayRule;
  autoPost: boolean;
}

/** Crée une récurrence après validation des références (portefeuilles, catégories). */
export async function createRecurring(
  input: RecurringInput,
  database: AppDatabase = defaultDb,
): Promise<Recurring> {
  const record = await validateDraft(
    { ...input.draft, date: input.startDate, status: "posted" },
    database,
    { isNew: true },
  );
  const now = new Date().toISOString();
  const candidate = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    type: record.type,
    amount: record.amount,
    currency: record.currency,
    walletId: record.walletId,
    toWalletId: record.toWalletId,
    categoryId: record.categoryId,
    subcategoryId: record.subcategoryId,
    memo: record.memo,
    frequency: input.frequency,
    startDate: input.startDate,
    endDate: input.endDate || undefined,
    nextDate: input.startDate,
    occurrenceIndex: 0,
    autoPost: input.autoPost,
    paused: false,
    dayOfMonthRule: input.dayOfMonthRule,
    archived: false,
  };
  const parsed = recurringSchema.safeParse(candidate);
  if (!parsed.success)
    throw new RuleError(parsed.error.issues[0]?.message ?? "Récurrence invalide");
  await database.recurring.add(parsed.data);
  return parsed.data;
}

/**
 * Rattrapage à l'ouverture (SPEC §5.7) : crée toutes les occurrences échues, une seule fois.
 * L'index avance dans la même transaction que les écritures : relancer ne duplique rien.
 * Retourne le nombre de transactions créées.
 */
export async function generateDueOccurrences(
  now = new Date(),
  database: AppDatabase = defaultDb,
): Promise<number> {
  let created = 0;
  await database.transaction("rw", [database.recurring, database.transactions], async () => {
    const active = await database.recurring.filter((r) => !r.paused && !r.archived).toArray();
    for (const r of active) {
      const dates = dueOccurrences(r, now);
      if (dates.length === 0) continue;

      const rows: Transaction[] = dates.map((date) =>
        transactionSchema.parse({
          id: crypto.randomUUID(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          walletId: r.walletId,
          toWalletId: r.toWalletId,
          categoryId: r.categoryId,
          subcategoryId: r.subcategoryId,
          memo: r.memo,
          attachmentIds: [],
          date: date.toISOString(),
          status: r.autoPost ? "posted" : "pending",
          recurringId: r.id,
        }),
      );
      await database.transactions.bulkAdd(rows);

      const nextIndex = r.occurrenceIndex + dates.length;
      const next = occurrenceDate(new Date(r.startDate), r.frequency, nextIndex, r.dayOfMonthRule);
      await database.recurring.update(r.id, {
        occurrenceIndex: nextIndex,
        nextDate: next.toISOString(),
        updatedAt: now.toISOString(),
      });
      created += rows.length;
    }
  });
  return created;
}

/** Pause ou reprise. À la reprise, les occurrences passées pendant la pause sont ignorées (pas de rafale). */
export async function setRecurringPaused(
  id: string,
  paused: boolean,
  database: AppDatabase = defaultDb,
  now: Date = new Date(),
): Promise<void> {
  const r = await database.recurring.get(id);
  if (!r) return;
  const occurrenceIndex = paused
    ? r.occurrenceIndex
    : Math.max(r.occurrenceIndex, indexAfter(r, now));
  await database.recurring.update(id, {
    paused,
    occurrenceIndex,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteRecurring(
  id: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.recurring.delete(id);
}

/** Valide une transaction en attente : elle devient une transaction réelle. */
export async function validatePending(
  id: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  await database.transactions.update(id, { status: "posted", updatedAt: new Date().toISOString() });
}

/** Reporte une transaction en attente d'un jour. */
export async function postponePending(
  id: string,
  database: AppDatabase = defaultDb,
): Promise<void> {
  const tx = await database.transactions.get(id);
  if (!tx) return;
  const next = new Date(new Date(tx.date).getTime() + 24 * 60 * 60 * 1000).toISOString();
  await database.transactions.update(id, { date: next, updatedAt: new Date().toISOString() });
}

/** Ignore une transaction en attente : elle est supprimée ; l'occurrence reste traitée (l'index a déjà avancé). */
export async function ignorePending(id: string, database: AppDatabase = defaultDb): Promise<void> {
  await database.transactions.delete(id);
}
