import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { RuleError } from "../../db/errors";
import { Field, buttonDanger, buttonPrimary, inputClass } from "../../components/FormControls";
import { debtState } from "../../domain/debts";
import { formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import type { Debt } from "../../db/entities";
import { addDebtPayment, createDebt, deleteDebt } from "./goals-debts-service";

const EMPTY: never[] = [];

export function DebtsPage() {
  const { id } = useParams();
  return id ? <DebtDetail id={id} /> : <DebtList />;
}

function DebtList() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Debt["direction"]>("borrowed");
  const [creating, setCreating] = useState(false);
  const debts = useLiveQuery(() => db.debts.toArray(), []) ?? EMPTY;
  const payments = useLiveQuery(() => db.debtPayments.toArray(), []) ?? EMPTY;
  const now = new Date();
  const shown = debts.filter((d) => d.direction === tab);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("debts.title")}</h1>
        <button type="button" className={buttonPrimary} onClick={() => setCreating((c) => !c)}>
          {t("common.add")}
        </button>
      </header>

      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(["borrowed", "lent"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={tab === d}
            onClick={() => setTab(d)}
            className={`min-h-[44px] rounded-lg border font-medium ${tab === d ? "border-brand-700 bg-brand-50 text-brand-700 dark:bg-raised" : "border-slate-300 dark:border-slate-700"}`}
          >
            {t(`debts.tabs.${d}`)}
          </button>
        ))}
      </div>

      {creating ? <DebtForm direction={tab} onDone={() => setCreating(false)} /> : null}
      {shown.length === 0 && !creating ? (
        <p className="text-slate-500">{t("debts.empty")}</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {shown.map((d) => {
          const state = debtState(
            d,
            payments.filter((p) => p.debtId === d.id),
            now,
          );
          return (
            <li key={d.id}>
              <Link
                to={`/plus/debts/${d.id}`}
                className="flex justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <span>
                  <span className="font-medium">{d.counterparty}</span>
                  <span className="block text-sm text-slate-500">
                    {t(`debts.status.${state.status}`)}
                  </span>
                </span>
                <span className="font-semibold">{formatMoney(state.remaining, d.currency)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DebtForm({ direction, onDone }: { direction: Debt["direction"]; onDone: () => void }) {
  const { t } = useTranslation();
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const currency: CurrencyCode = wallets[0]?.currency ?? "MGA";
  const [counterparty, setCounterparty] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function save() {
    setError(undefined);
    const amount = parseMoney(principal, currency);
    if (amount === null || amount <= 0) return setError(t("errors.invalidAmount"));
    const pct = rate.trim() === "" ? undefined : Number(rate.replace(",", "."));
    if (pct !== undefined && (!Number.isFinite(pct) || pct < 0))
      return setError(t("debts.invalidRate"));
    try {
      await createDebt({
        direction,
        counterparty,
        principal: amount,
        currency,
        startDate: new Date(`${startDate}T00:00`).toISOString(),
        dueDate: dueDate ? new Date(`${dueDate}T23:59`).toISOString() : undefined,
        interestRate: pct,
        notes,
      });
      onDone();
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <Field label={direction === "borrowed" ? t("debts.creditor") : t("debts.debtor")}>
        <input
          className={inputClass}
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
        />
      </Field>
      <Field label={`${t("debts.principal")} (${currency})`}>
        <input
          inputMode="decimal"
          className={inputClass}
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />
      </Field>
      <Field label={t("debts.rate")}>
        <input
          inputMode="decimal"
          className={inputClass}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>
      <Field label={t("debts.startDate")}>
        <input
          type="date"
          className={inputClass}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </Field>
      <Field label={t("debts.dueDate")}>
        <input
          type="date"
          className={inputClass}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </Field>
      <Field label={t("transactions.memo")}>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button type="button" className={buttonPrimary} onClick={() => void save()}>
        {t("common.save")}
      </button>
    </div>
  );
}

function DebtDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const debt = useLiveQuery(() => db.debts.get(id), [id]);
  const payments =
    useLiveQuery(
      async () =>
        (await db.debtPayments.where("debtId").equals(id).toArray()).sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      [id],
    ) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [memo, setMemo] = useState("");
  const [linkWallet, setLinkWallet] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (debt === undefined) return null;
  if (!debt) return <p>{t("debts.notFound")}</p>;
  const state = debtState(debt, payments, new Date());
  const debtCurrency = debt.currency;

  async function pay() {
    setError(undefined);
    const value = parseMoney(amount, debtCurrency);
    if (value === null || value <= 0) return setError(t("errors.invalidAmount"));
    if (value > state.remaining) return setError(t("debts.tooMuch"));
    try {
      await addDebtPayment(id, value, new Date(date).toISOString(), memo, linkWallet || undefined);
      setAmount("");
      setMemo("");
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{debt.counterparty}</h1>
      <p className="text-sm text-slate-500">{t(`debts.status.${state.status}`)}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Figure label={t("debts.principal")} value={formatMoney(debt.principal, debt.currency)} />
        <Figure
          label={t("debts.interest")}
          value={formatMoney(state.totalDue - debt.principal, debt.currency)}
        />
        <Figure label={t("debts.paid")} value={formatMoney(state.paid, debt.currency)} />
        <Figure label={t("debts.remaining")} value={formatMoney(state.remaining, debt.currency)} />
      </div>

      {state.remaining > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <Field label={`${t("debts.payment")} (${debt.currency})`}>
            <input
              inputMode="decimal"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label={t("transactions.date")}>
            <input
              type="datetime-local"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t("transactions.memo")}>
            <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
          <Field label={t("debts.linkWallet")}>
            <select
              className={inputClass}
              value={linkWallet}
              onChange={(e) => setLinkWallet(e.target.value)}
            >
              <option value="">{t("goals.noLink")}</option>
              {wallets
                .filter((w) => w.currency === debt.currency && !w.archived)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </Field>
          {error ? (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <button type="button" className={buttonPrimary} onClick={() => void pay()}>
            {t("debts.addPayment")}
          </button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-1 text-sm">
        {payments.map((p) => (
          <li key={p.id} className="flex justify-between">
            <span>
              {format(new Date(p.date), "dd/MM/yyyy")} · {p.memo}
            </span>
            <span>{formatMoney(p.amount, debt.currency)}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={buttonDanger}
        onClick={async () => {
          if (!window.confirm(t("debts.deleteConfirm"))) return;
          await deleteDebt(id);
          navigate("/plus/debts", { replace: true });
        }}
      >
        {t("common.delete")}
      </button>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <p className="text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
