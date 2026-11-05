import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { ActionMenu, DetailHeader } from "../../components/DetailHeader";
import { budgetState } from "../../domain/budget";
import { contains } from "../../domain/period";
import { upTo } from "../../domain/cutoff";
import { useBalanceCutoff } from "../settings/balance-cutoff";
import { formatMoney } from "../../lib/money";
import { usePeriodSettings } from "../stats/period-state";
import { deleteBudget } from "./budget-service";

const EMPTY: never[] = [];

export function BudgetDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = usePeriodSettings();
  const { id = "" } = useParams();
  const [now] = useState(() => new Date());
  const budget = useLiveQuery(() => db.budgets.get(id), [id]);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const cutoff = useBalanceCutoff();
  if (budget === undefined) return null;
  if (!budget) return <p>{t("budgets.notFound")}</p>;

  const visible = upTo(transactions, cutoff);
  const state = budgetState(budget, visible, now, settings);
  const counted = visible
    .filter(
      (tx) =>
        tx.type === "expense" &&
        tx.status === "posted" &&
        tx.currency === budget.currency &&
        tx.categoryId !== undefined &&
        budget.categoryIds.includes(tx.categoryId) &&
        (budget.walletIds.length === 0 || budget.walletIds.includes(tx.walletId)) &&
        contains(state.period, tx.date),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  async function remove() {
    if (!window.confirm(t("budgets.deleteConfirm"))) return;
    await deleteBudget(id);
    navigate("/budgets", { replace: true });
  }

  return (
    <section className="flex flex-col gap-4">
      <DetailHeader
        title={budget.name}
        actions={
          <ActionMenu
            items={[
              { label: t("common.edit"), to: `/budgets/${id}/edit` },
              { label: t("common.delete"), onSelect: () => void remove(), danger: true },
            ]}
          />
        }
      />
      <p className="text-sm text-slate-600">
        {t(`budgets.periods.${budget.period}`)} ·{" "}
        {t("budgets.alertAt", { percent: budget.alertThreshold })}
        {budget.rollover ? ` · ${t("budgets.rolloverOn")}` : ""}
      </p>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Figure label={t("budgets.base")} value={formatMoney(state.base, budget.currency)} />
        <Figure label={t("budgets.carry")} value={formatMoney(state.carry, budget.currency)} />
        <Figure label={t("budgets.spent")} value={formatMoney(state.spent, budget.currency)} />
        <Figure
          label={t("budgets.remainingLabel")}
          value={formatMoney(state.remaining, budget.currency)}
        />
      </div>
      <p className="text-sm">
        {t("budgets.percentUsed", { percent: state.percent })}
        {state.dailyAllowance !== null
          ? ` · ${t("budgets.dailyAllowance", { amount: formatMoney(state.dailyAllowance, budget.currency) })}`
          : ""}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("budgets.counted")}</h2>
        {counted.length === 0 ? <p className="text-slate-600">{t("budgets.noCounted")}</p> : null}
        <ul className="flex flex-col gap-1 text-sm">
          {counted.map((tx) => (
            <li key={tx.id}>
              <Link to={`/transactions/${tx.id}/edit`} className="flex justify-between">
                <span>
                  {format(new Date(tx.date), "dd/MM HH:mm")} ·{" "}
                  {tx.memo || t("transactions.types.expense")}
                </span>
                <span>{formatMoney(tx.amount, tx.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-white/15">
      <p className="text-slate-600">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
