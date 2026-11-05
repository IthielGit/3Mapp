import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { RuleError } from "../../db/errors";
import {
  Field,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "../../components/FormControls";
import { goalProgress } from "../../domain/goals";
import { formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import { addGoalMovement, createGoal, deleteGoal, setGoalArchived } from "./goals-debts-service";
import { askConfirm } from "../../components/confirm-service";

const EMPTY: never[] = [];

export function GoalsPage() {
  const { id } = useParams();
  return id ? <GoalDetail id={id} /> : <GoalList />;
}

function GoalList() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? EMPTY;
  const movements = useLiveQuery(() => db.goalTransactions.toArray(), []) ?? EMPTY;
  const now = new Date();

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <PageTitle className="text-2xl font-semibold">{t("goals.title")}</PageTitle>
        <button type="button" className={buttonPrimary} onClick={() => setCreating((c) => !c)}>
          {t("common.add")}
        </button>
      </header>

      {creating ? <GoalForm onDone={() => setCreating(false)} /> : null}
      {goals.length === 0 && !creating ? (
        <p className="text-neutral-600 dark:text-muted">{t("goals.empty")}</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {goals
          .filter((g) => !g.archived)
          .map((g) => {
            const deposits = movements.filter((m) => m.goalId === g.id);
            const p = goalProgress(g.targetAmount, deposits, now);
            return (
              <li key={g.id}>
                <Link
                  to={`/plus/goals/${g.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-white/15"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {g.icon} {g.name}
                    </span>
                    <span className="text-sm">{p.percent} %</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={p.percent}
                    aria-label={g.name}
                    className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
                  >
                    <div className="h-full bg-brand-600" style={{ width: `${p.percent}%` }} />
                  </div>
                  <span className="text-sm text-neutral-600 dark:text-muted">
                    {formatMoney(p.saved, g.currency)} / {formatMoney(g.targetAmount, g.currency)}
                    {p.reached
                      ? ` · ${t("goals.reached")}`
                      : p.estimatedDate
                        ? ` · ${t("goals.estimated", { date: format(p.estimatedDate, "dd/MM/yyyy") })}`
                        : ""}
                  </span>
                </Link>
              </li>
            );
          })}
      </ul>
    </section>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const currency: CurrencyCode = wallets[0]?.currency ?? "MGA";

  function missingGoal(): string | null {
    if (name.trim() === "") return t("forms.missingName");
    const amount = parseMoney(target, currency);
    if (amount === null || amount <= 0) return t("transactions.amountRequired");
    return null;
  }

  async function save() {
    setError(undefined);
    const amount = parseMoney(target, currency);
    if (name.trim() === "") return setNameError(t("errors.required"));
    if (amount === null || amount <= 0) return setError(t("errors.invalidAmount"));
    await createGoal({
      name: name.trim(),
      icon: "🎯",
      targetAmount: amount,
      currency,
      targetDate: targetDate ? new Date(`${targetDate}T12:00`).toISOString() : undefined,
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-white/15">
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
      <Field label={`${t("goals.target")} (${currency})`}>
        <input
          inputMode="decimal"
          className={inputClass}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </Field>
      <Field label={t("goals.targetDate")}>
        <input
          type="date"
          className={inputClass}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {missingGoal() ? <p className="text-sm text-neutral-600 dark:text-muted">{missingGoal()}</p> : null}
      <button type="button" className={buttonPrimary} onClick={() => void save()} disabled={missingGoal() !== null}>
        {t("common.save")}
      </button>
    </div>
  );
}

function GoalDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goal = useLiveQuery(() => db.goals.get(id), [id]);
  const movements =
    useLiveQuery(
      async () =>
        (await db.goalTransactions.where("goalId").equals(id).toArray()).sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      [id],
    ) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const [amount, setAmount] = useState("");
  const [withdraw, setWithdraw] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [memo, setMemo] = useState("");
  const [linkWallet, setLinkWallet] = useState("");
  const [error, setError] = useState<string | undefined>();

  if (goal === undefined) return null;
  if (!goal) return <p>{t("goals.notFound")}</p>;
  const p = goalProgress(goal.targetAmount, movements, new Date());
  const goalCurrency = goal.currency;

  function missingMovement(): string | null {
    const value = parseMoney(amount, goalCurrency);
    if (value === null || value <= 0) return t("transactions.amountRequired");
    return null;
  }

  async function addMovement() {
    setError(undefined);
    const value = parseMoney(amount, goalCurrency);
    if (value === null || value <= 0) return setError(t("errors.invalidAmount"));
    try {
      await addGoalMovement(
        id,
        withdraw ? -value : value,
        new Date(date).toISOString(),
        memo,
        linkWallet || undefined,
      );
      setAmount("");
      setMemo("");
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">
        {goal.icon} {goal.name}
      </PageTitle>
      <p className="text-lg">
        {formatMoney(p.saved, goal.currency)} / {formatMoney(goal.targetAmount, goal.currency)} ·{" "}
        {p.percent} %
      </p>
      <p className="text-sm text-neutral-600 dark:text-muted">
        {p.reached
          ? t("goals.reached")
          : p.estimatedDate
            ? t("goals.estimated", { date: format(p.estimatedDate, "dd/MM/yyyy") })
            : t("goals.noEstimate")}
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3 dark:border-white/15">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={!withdraw}
            className={buttonSecondary}
            onClick={() => setWithdraw(false)}
          >
            {t("goals.deposit")}
          </button>
          <button
            type="button"
            aria-pressed={withdraw}
            className={buttonSecondary}
            onClick={() => setWithdraw(true)}
          >
            {t("goals.withdraw")}
          </button>
        </div>
        <Field label={`${t("transactions.amount")} (${goal.currency})`}>
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
        <Field label={t("goals.linkWallet")}>
          <select
            className={inputClass}
            value={linkWallet}
            onChange={(e) => setLinkWallet(e.target.value)}
          >
            <option value="">{t("goals.noLink")}</option>
            {wallets
              .filter((w) => w.currency === goal.currency && !w.archived)
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
        {missingMovement() ? <p className="text-sm text-neutral-600 dark:text-muted">{missingMovement()}</p> : null}
        <button type="button" className={buttonPrimary} onClick={() => void addMovement()} disabled={missingMovement() !== null}>
          {t("common.save")}
        </button>
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {movements.map((m) => (
          <li key={m.id} className="flex justify-between">
            <span>
              {format(new Date(m.date), "dd/MM/yyyy")} · {m.memo}
            </span>
            <span>{formatMoney(m.amount, goal.currency)}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => void setGoalArchived(id, !goal.archived)}
        >
          {goal.archived ? t("common.restore") : t("common.archive")}
        </button>
        <button
          type="button"
          className={buttonDanger}
          onClick={async () => {
            if (!(await askConfirm({ message: t("goals.deleteConfirm") }))) return;
            await deleteGoal(id);
            navigate("/plus/goals", { replace: true });
          }}
        >
          {t("common.delete")}
        </button>
      </div>
    </section>
  );
}
