import { db as defaultDb, type AppDatabase } from "../../db/database";
import { RuleError } from "../../db/errors";
import { templateSchema, type Template } from "../../db/entities";
import { draftFromTransaction, validateDraft, type TransactionDraft } from "./transaction-service";

/** Modèle : une transaction pré-remplie, sans date ni statut (SPEC §5.6). */
export type TemplateDraft = Omit<TransactionDraft, "date" | "status">;

export async function createTemplate(
  name: string,
  icon: string,
  draft: TemplateDraft,
  database: AppDatabase = defaultDb,
): Promise<Template> {
  if (name.trim() === "") throw new RuleError("Nom du modèle requis");
  const record = await validateDraft(
    { ...draft, date: new Date().toISOString(), status: "posted" },
    database,
    { isNew: true },
  );
  const now = new Date().toISOString();
  const {
    date: _date,
    status: _status,
    currency: _currency,
    ...fields
  } = { ...record, date: "", status: "posted" as const };
  void _date;
  void _status;
  void _currency;
  const parsed = templateSchema.safeParse({
    ...fields,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    currency: record.currency,
    name: name.trim(),
    icon,
    archived: false,
  });
  if (!parsed.success) throw new RuleError(parsed.error.issues[0]?.message ?? "Modèle invalide");
  await database.templates.add(parsed.data);
  return parsed.data;
}

/** Enregistre une transaction existante comme modèle. */
export async function saveTransactionAsTemplate(
  transactionId: string,
  name: string,
  icon: string,
  database: AppDatabase = defaultDb,
): Promise<Template> {
  const tx = await database.transactions.get(transactionId);
  if (!tx) throw new RuleError("Transaction introuvable");
  const { date: _date, status: _status, ...draft } = draftFromTransaction(tx);
  void _date;
  void _status;
  return createTemplate(name, icon, draft, database);
}

/** Pré-remplissage : brouillon de transaction à partir d'un modèle, daté de maintenant. */
export function draftFromTemplate(template: Template): TransactionDraft {
  return {
    type: template.type,
    amount: template.amount,
    walletId: template.walletId,
    toWalletId: template.toWalletId,
    toAmount: template.toAmount,
    fee: template.fee,
    categoryId: template.categoryId,
    subcategoryId: template.subcategoryId,
    memo: template.memo,
    attachmentIds: [],
    date: new Date().toISOString(),
    status: "posted",
  };
}

export async function deleteTemplate(id: string, database: AppDatabase = defaultDb): Promise<void> {
  await database.templates.delete(id);
}
