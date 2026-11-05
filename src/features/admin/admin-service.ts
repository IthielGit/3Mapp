import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** Erreurs de la console, classées pour l'affichage. */
export type AdminErrorCode = "forbidden" | "network" | "invalid" | "unknown";

export class AdminError extends Error {
  readonly code: AdminErrorCode;
  constructor(code: AdminErrorCode) {
    super(`admin:${code}`);
    this.name = "AdminError";
    this.code = code;
  }
}

const accountSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(["user", "super_admin"]),
  status: z.enum(["active", "suspended"]),
  created_at: z.string(),
  last_sync_at: z.string().nullable(),
  record_count: z.coerce.number(),
});

const recordSchema = z.object({
  record_id: z.string(),
  updated_at: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
});

const auditSchema = z.object({
  id: z.coerce.number(),
  admin_id: z.uuid(),
  action: z.string(),
  target_id: z.uuid().nullable(),
  target_email: z.string().nullable(),
  at: z.string(),
});

export type AdminAccount = z.infer<typeof accountSchema>;
export type AdminRecord = z.infer<typeof recordSchema>;
export type AdminAuditEntry = z.infer<typeof auditSchema>;

function classify(error: { code?: string; message?: string } | null): AdminError {
  const message = (error?.message ?? "").toLowerCase();
  if (error?.code === "42501" || message.includes("forbidden")) return new AdminError("forbidden");
  if (message.includes("fetch") || message.includes("network")) return new AdminError("network");
  return new AdminError("unknown");
}

/** Appel d'une fonction d'administration ; la réponse est validée avant d'être utilisée. */
async function call<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw classify(error);
  const parsed = z.array(schema).safeParse(data ?? []);
  if (!parsed.success) throw new AdminError("invalid");
  return parsed.data;
}

export async function listAccounts(client: SupabaseClient): Promise<AdminAccount[]> {
  return call(client, "admin_list_accounts", {}, accountSchema);
}

export async function listRecords(
  client: SupabaseClient,
  userId: string,
  table: string,
  limit = 100,
): Promise<AdminRecord[]> {
  return call(client, "admin_list_records", { p_user: userId, p_table: table, p_limit: limit }, recordSchema);
}

export async function setAccountStatus(
  client: SupabaseClient,
  userId: string,
  status: "active" | "suspended",
): Promise<void> {
  const { error } = await client.rpc("admin_set_status", { p_user: userId, p_status: status });
  if (error) throw classify(error);
}

export async function deleteAccount(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.rpc("admin_delete_account", { p_user: userId });
  if (error) throw classify(error);
}

export async function listAudit(client: SupabaseClient, limit = 200): Promise<AdminAuditEntry[]> {
  return call(client, "admin_audit_list", { p_limit: limit }, auditSchema);
}
