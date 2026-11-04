import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { buttonPrimary, buttonSecondary, Field, inputClass } from "../../components/FormControls";
import { formatMoney, type CurrencyCode } from "../../lib/money";
import { downloadBlob } from "../../lib/download";
import {
  autoMapping,
  buildRows,
  decodeBytes,
  executeImport,
  existingSignatures,
  IMPORT_FIELDS,
  parseCsvText,
  planImport,
  REQUIRED_FIELDS,
  type ImportField,
  type ImportPlan,
  type Mapping,
  type ParsedFile,
  type ImportResult,
} from "./csv-import";
import {
  loadExportNames,
  transactionsToCsv,
  transactionsToJson,
  transactionsToXlsx,
} from "./export";

export function ImportExportPage() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.toArray(), []);
  const baseCurrency: CurrencyCode = settings?.[0]?.baseCurrency ?? "MGA";

  const [file, setFile] = useState<ParsedFile | undefined>();
  const [mapping, setMapping] = useState<Mapping>({});
  const [plan, setPlan] = useState<ImportPlan | undefined>();
  const [result, setResult] = useState<ImportResult | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  async function onFile(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (!picked) return;
    setMessage(undefined);
    setResult(undefined);
    setPlan(undefined);
    const text = decodeBytes(await picked.arrayBuffer());
    const parsed = parseCsvText(text);
    setFile(parsed);
    setMapping(autoMapping(parsed.headers));
  }

  const mappingComplete = REQUIRED_FIELDS.every((f) => mapping[f]);

  async function preview() {
    if (!file) return;
    setResult(undefined);
    const rows = buildRows(file, mapping, baseCurrency);
    const existing = await existingSignatures();
    setPlan(planImport(rows, existing));
  }

  async function runImport() {
    if (!plan) return;
    try {
      const outcome = await executeImport(plan);
      setResult(outcome);
      setPlan(undefined);
      setFile(undefined);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  async function exportAs(format: "csv" | "xlsx" | "json") {
    setMessage(undefined);
    const names = await loadExportNames();
    const transactions = (await db.transactions.toArray()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      downloadBlob(
        new Blob([transactionsToCsv(transactions, names)], { type: "text/csv;charset=utf-8" }),
        `transactions-${stamp}.csv`,
      );
    } else if (format === "json") {
      downloadBlob(
        new Blob([transactionsToJson(transactions, names)], { type: "application/json" }),
        `transactions-${stamp}.json`,
      );
    } else {
      const bytes = await transactionsToXlsx(transactions, names, wallets ?? []);
      downloadBlob(
        new Blob([bytes.slice().buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `transactions-${stamp}.xlsx`,
      );
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageTitle className="text-2xl font-bold">{t("importExport.title")}</PageTitle>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("importExport.importTitle")}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t("importExport.importHint")}</p>
        <label
          className={`${buttonSecondary} flex w-full cursor-pointer items-center justify-center text-center focus-within:outline focus-within:outline-2 focus-within:outline-accent`}
        >
          {t("importExport.chooseFile")}
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files)}
          />
        </label>

        {file ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {t("importExport.separator", {
                separator: file.separator === "\t" ? "tab" : file.separator,
              })}
            </p>
            {IMPORT_FIELDS.map((field) => (
              <MappingSelect
                key={field}
                field={field}
                headers={file.headers}
                value={mapping[field] ?? null}
                required={REQUIRED_FIELDS.includes(field)}
                onChange={(column) => setMapping((m) => ({ ...m, [field]: column }))}
              />
            ))}
            <button
              type="button"
              className={buttonSecondary}
              disabled={!mappingComplete}
              onClick={() => void preview()}
            >
              {t("importExport.preview")}
            </button>
          </div>
        ) : null}

        {plan ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/15">
            <p>
              {t("importExport.summary", {
                valid: plan.valid.length,
                duplicates: plan.duplicates.length,
                invalid: plan.invalid.length,
              })}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {plan.valid.slice(0, 10).map((row) => (
                <li key={row.line}>
                  {row.date.slice(0, 16).replace("T", " ")} · {t(`transactions.types.${row.type}`)}{" "}
                  · {row.walletName}
                  {row.toWalletName ? ` → ${row.toWalletName}` : ""} ·{" "}
                  {formatMoney(row.amount, row.currency)}
                </li>
              ))}
            </ul>
            {plan.invalid.length > 0 ? (
              <div role="alert" className="text-sm text-red-700 dark:text-red-400">
                <p className="font-semibold">{t("importExport.errorsTitle")}</p>
                <ul>
                  {plan.invalid.slice(0, 50).map((row) => (
                    <li key={row.line}>
                      {t("importExport.line", { line: row.line })} : {row.errors.join(" ; ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              className={buttonPrimary}
              disabled={plan.valid.length === 0}
              onClick={() => void runImport()}
            >
              {t("importExport.importButton", { count: plan.valid.length })}
            </button>
          </div>
        ) : null}

        {result ? (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          >
            {t("importExport.done", {
              created: result.created,
              duplicates: result.duplicates,
              invalid: result.invalid.length,
              wallets: result.walletsCreated,
              categories: result.categoriesCreated,
            })}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/15">
        <h2 className="font-semibold">{t("importExport.exportTitle")}</h2>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={buttonSecondary} onClick={() => void exportAs("csv")}>
            CSV
          </button>
          <button type="button" className={buttonSecondary} onClick={() => void exportAs("xlsx")}>
            XLSX
          </button>
          <button type="button" className={buttonSecondary} onClick={() => void exportAs("json")}>
            JSON
          </button>
        </div>
      </section>

      {message ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function MappingSelect({
  field,
  headers,
  value,
  required,
  onChange,
}: {
  field: ImportField;
  headers: string[];
  value: string | null;
  required: boolean;
  onChange: (column: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field label={`${t(`importExport.fields.${field}`)}${required ? " *" : ""}`}>
      <select
        className={inputClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </Field>
  );
}
