import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { RuleError } from "../../db/errors";
import { CURRENCIES, type CurrencyCode } from "../../lib/money";
import { buttonDanger, buttonPrimary, Field, inputClass } from "../../components/FormControls";
import { deleteRate, saveRate } from "./money-services";

const EMPTY: never[] = [];
const CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Devises et taux de change datés (SPEC §3, §5.16). */
export function RatesPage() {
  const { t } = useTranslation();
  const rates = useLiveQuery(() => db.exchangeRates.toArray(), []) ?? EMPTY;
  const [from, setFrom] = useState<CurrencyCode>("EUR");
  const [to, setTo] = useState<CurrencyCode>("MGA");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [error, setError] = useState<string | undefined>();

  async function save() {
    setError(undefined);
    const value = Number(rate.replace(",", "."));
    try {
      await saveRate(from, to, value, new Date(`${date}T12:00`).toISOString());
      setRate("");
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  const sorted = [...rates].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">{t("rates.title")}</PageTitle>
      <p className="text-sm text-slate-600 dark:text-muted">{t("rates.hint")}</p>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("rates.from")}>
          <select
            className={inputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value as CurrencyCode)}
          >
            {CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("rates.to")}>
          <select
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value as CurrencyCode)}
          >
            {CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("rates.rate", { from, to })}>
        <input
          inputMode="decimal"
          className={inputClass}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>
      <Field label={t("rates.date")}>
        <input
          type="date"
          className={inputClass}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button type="button" className={buttonPrimary} onClick={() => void save()}>
        {t("rates.add")}
      </button>

      <ul className="flex flex-col gap-2">
        {sorted.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/15"
          >
            <span>
              {format(new Date(r.date), "dd/MM/yyyy")} · 1 {r.from} = {r.rate} {r.to}
            </span>
            <button type="button" className={buttonDanger} onClick={() => void deleteRate(r.id)}>
              {t("common.delete")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
