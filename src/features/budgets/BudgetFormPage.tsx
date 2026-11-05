import { PageTitle } from "../../components/PageHeader";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { byName } from "../../lib/compare";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import { createBudget, updateBudget, type BudgetInput } from "./budget-service";
import type { Budget } from "../../db/entities";

const EMPTY: never[] = [];

export function BudgetFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const settings = useLiveQuery(() => db.settings.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const currency: CurrencyCode = settings[0]?.baseCurrency ?? "MGA";

  const [loaded, setLoaded] = useState(!id);
  const [existing, setExisting] = useState<Budget | undefined>();
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [period, setPeriod] = useState<Budget["period"]>("month");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const [rollover, setRollover] = useState(false);
  const [threshold, setThreshold] = useState("80");
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (!id) return;
    void db.budgets.get(id).then((b) => {
      if (!b) return;
      setExisting(b);
      setName(b.name);
      setAmountText(formatMoney(b.amount, b.currency, { withSymbol: false }));
      setPeriod(b.period);
      setStartDate(format(new Date(b.startDate), "yyyy-MM-dd"));
      setEndDate(b.endDate ? format(new Date(b.endDate), "yyyy-MM-dd") : "");
      setCategoryIds(b.categoryIds);
      setWalletIds(b.walletIds);
      setRollover(b.rollover);
      setThreshold(String(b.alertThreshold));
      setLoaded(true);
    });
  }, [id]);

  if (!loaded) return null;

  const expenseCategories = categories.filter((c) => c.kind === "expense" && !c.archived).sort(byName);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  function missingField(): string | null {
    if (name.trim() === "") return t("forms.missingName");
    const amount = parseMoney(amountText, currency);
    if (amount === null || amount <= 0) return t("transactions.amountRequired");
    if (categoryIds.length === 0) return t("budgets.needCategory");
    return null;
  }

  async function save() {
    setError(undefined);
    if (name.trim() === "") return setNameError(t("errors.required"));
    const amount = parseMoney(amountText, currency);
    if (amount === null || amount <= 0) return setError(t("errors.invalidAmount"));
    if (categoryIds.length === 0) return setError(t("budgets.needCategory"));
    const pct = Number(threshold);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100)
      return setError(t("budgets.invalidThreshold"));

    const input: BudgetInput = {
      name: name.trim(),
      amount,
      currency,
      period,
      startDate: new Date(`${startDate}T00:00`).toISOString(),
      endDate:
        period === "custom" && endDate ? new Date(`${endDate}T23:59`).toISOString() : undefined,
      categoryIds,
      walletIds,
      rollover,
      alertThreshold: pct,
    };
    try {
      if (existing) await updateBudget(existing.id, input);
      else await createBudget(input);
      navigate("/budgets", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <PageTitle className="text-2xl font-semibold">
        {existing ? t("budgets.editTitle") : t("budgets.newTitle")}
      </PageTitle>

      <Field label={t("common.name")} error={nameError}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t("budgets.amount")} (${currency})`}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={() => {
              // À la sortie du champ, le montant reprend le format de la liste (300 000 au lieu de 300000).
              const value = parseMoney(amountText, currency);
              if (value !== null && value > 0) setAmountText(formatMoney(value, currency, { withSymbol: false }));
            }}
          />
        </Field>
        <Field label={t("budgets.periodLabel")}>
          <select
            className={inputClass}
            value={period}
            onChange={(e) => setPeriod(e.target.value as Budget["period"])}
          >
            {(["week", "month", "year", "custom"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`budgets.periods.${p}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("budgets.startDate")}>
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        {period === "custom" ? (
          <Field label={t("budgets.endDate")}>
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        ) : null}
      </div>

      <fieldset className="grid grid-cols-2 gap-x-3 gap-y-0">
        <legend className="mb-1 text-sm font-medium">{t("budgets.categories")}</legend>
        {expenseCategories.map((c) => (
          <label key={c.id} className="flex min-h-[44px] items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0"
              checked={categoryIds.includes(c.id)}
              onChange={() => setCategoryIds((ids) => toggle(ids, c.id))}
            />
            <span>
              {c.icon} {c.name}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex min-h-[44px] items-center gap-2">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0"
          checked={rollover}
          onChange={(e) => setRollover(e.target.checked)}
        />
        {t("budgets.rollover")}
      </label>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {missingField() ? <p className="text-sm text-neutral-600 dark:text-muted">{missingField()}</p> : null}
      <div className="flex justify-end gap-3">
        <button type="button" className={buttonSecondary} onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </button>
        <button type="button" className={buttonPrimary} onClick={() => void save()} disabled={missingField() !== null}>
          {t("common.save")}
        </button>
      </div>
    </section>
  );
}
