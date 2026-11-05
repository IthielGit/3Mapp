import { PageTitle } from "../../components/PageHeader";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { buttonPrimary, buttonSecondary, buttonDanger } from "../../components/FormControls";
import { formatMoney } from "../../lib/money";
import {
  ignorePending,
  postponePending,
  validatePending,
  setRecurringPaused,
  deleteRecurring,
} from "./recurring-service";

const EMPTY: never[] = [];

/** Liste des récurrences et écran « En attente » (SPEC §5.7). */
export function RecurringPage() {
  const { t } = useTranslation();
  const recurring = useLiveQuery(() => db.recurring.toArray(), []) ?? EMPTY;
  const pending =
    useLiveQuery(() => db.transactions.where("status").equals("pending").toArray(), []) ?? EMPTY;
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? EMPTY;
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-2">
        <PageTitle className="text-2xl font-semibold">{t("recurring.title")}</PageTitle>
        <Link to="/plus/recurring/new" className={buttonPrimary + " inline-flex items-center"}>
          {t("common.add")}
        </Link>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          {t("recurring.pendingTitle")} ({pending.length})
        </h2>
        {pending.length === 0 ? <p className="text-slate-600">{t("recurring.noPending")}</p> : null}
        <ul className="flex flex-col gap-2">
          {pending.map((tx) => (
            <li
              key={tx.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/15"
            >
              <div className="flex justify-between gap-2">
                <span>
                  {format(new Date(tx.date), "dd/MM/yyyy")} ·{" "}
                  {tx.memo || categoryName.get(tx.categoryId ?? "") || walletName.get(tx.walletId)}
                </span>
                <span className="font-medium">{formatMoney(tx.amount, tx.currency)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={buttonPrimary}
                  onClick={() => void validatePending(tx.id)}
                >
                  {t("recurring.validate")}
                </button>
                <button
                  type="button"
                  className={buttonSecondary}
                  onClick={() => void postponePending(tx.id)}
                >
                  {t("recurring.postpone")}
                </button>
                <button
                  type="button"
                  className={buttonDanger}
                  onClick={() => void ignorePending(tx.id)}
                >
                  {t("recurring.ignore")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("recurring.listTitle")}</h2>
        {recurring.length === 0 ? <p className="text-slate-600">{t("recurring.empty")}</p> : null}
        <ul className="flex flex-col gap-2">
          {recurring.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/15"
            >
              <Link to={`/plus/recurring/${r.id}`} className="flex flex-col">
                <span className="font-medium">
                  {r.memo ||
                    categoryName.get(r.categoryId ?? "") ||
                    t(`transactions.types.${r.type}`)}
                </span>
                <span className="text-sm text-slate-600">
                  {formatMoney(r.amount, r.currency)} ·{" "}
                  {t("recurring.every", {
                    interval: r.frequency.interval,
                    unit: t(`recurring.units.${r.frequency.unit}`),
                  })}
                  {r.paused ? ` · ${t("recurring.pausedBadge")}` : ""}
                </span>
              </Link>
              <button
                type="button"
                className={buttonSecondary}
                onClick={() => void setRecurringPaused(r.id, !r.paused)}
              >
                {r.paused ? t("recurring.resume") : t("recurring.pause")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

/** Détail d'une récurrence : historique des occurrences générées. */
export function RecurringDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const r = useLiveQuery(() => db.recurring.get(id), [id]);
  const occurrences =
    useLiveQuery(
      async () =>
        (await db.transactions.filter((tx) => tx.recurringId === id).toArray()).sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      [id],
    ) ?? EMPTY;
  if (r === undefined) return null;
  if (!r) return <p>{t("recurring.notFound")}</p>;

  async function remove() {
    if (!window.confirm(t("recurring.deleteConfirm"))) return;
    await deleteRecurring(id);
    navigate("/plus/recurring", { replace: true });
  }

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">
        {r.memo || t(`transactions.types.${r.type}`)}
      </PageTitle>
      <p className="text-sm text-slate-600">
        {formatMoney(r.amount, r.currency)} ·{" "}
        {t("recurring.every", {
          interval: r.frequency.interval,
          unit: t(`recurring.units.${r.frequency.unit}`),
        })}
        {r.paused ? ` · ${t("recurring.pausedBadge")}` : ""}
      </p>
      <p className="text-sm">
        {t("recurring.nextOn", { date: format(new Date(r.nextDate), "dd/MM/yyyy") })}
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("recurring.history")}</h2>
        {occurrences.length === 0 ? (
          <p className="text-slate-600">{t("recurring.noHistory")}</p>
        ) : null}
        <ul className="flex flex-col gap-1 text-sm">
          {occurrences.map((tx) => (
            <li key={tx.id}>
              <Link to={`/transactions/${tx.id}/edit`} className="flex justify-between">
                <span>
                  {format(new Date(tx.date), "dd/MM/yyyy")} ·{" "}
                  {tx.status === "pending" ? t("recurring.pendingTag") : t("recurring.postedTag")}
                </span>
                <span>{formatMoney(tx.amount, tx.currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={`/plus/recurring/${id}/edit`}
          className={`${buttonSecondary} inline-flex items-center justify-center`}
        >
          {t("common.edit")}
        </Link>
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => void setRecurringPaused(id, !r.paused)}
        >
          {r.paused ? t("recurring.resume") : t("recurring.pause")}
        </button>
        <button type="button" className={buttonDanger} onClick={() => void remove()}>
          {t("common.delete")}
        </button>
      </div>
    </section>
  );
}
