import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { RuleError } from "../../db/errors";
import { walletBalance } from "../../domain/balance";
import { upTo } from "../../domain/cutoff";
import { lastKnownActivity } from "../../domain/reconciliation";
import { useBalanceCutoff } from "../settings/balance-cutoff";
import { buttonPrimary, Field, inputClass } from "../../components/FormControls";
import { formatMoney, parseMoney } from "../../lib/money";
import { reconcileWallet } from "./money-services";

const EMPTY: never[] = [];

/** Réconciliation d'un portefeuille (SPEC §5.12) et historique des réconciliations. */
export function ReconcilePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const wallet = useLiveQuery(() => db.wallets.get(id), [id]);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const history =
    useLiveQuery(
      async () =>
        (await db.reconciliations.where("walletId").equals(id).toArray()).sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      [id],
    ) ?? EMPTY;
  const [real, setReal] = useState("");
  const [memo, setMemo] = useState("");
  const [undetailed, setUndetailed] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const cutoff = useBalanceCutoff();

  if (wallet === undefined) return null;
  if (!wallet) return <p>{t("wallets.notFound")}</p>;
  const currency = wallet.currency;
  const computed = walletBalance(wallet, upTo(transactions, cutoff));
  const realValue = real.trim() === "" ? null : parseMoney(real, currency);
  const gap = realValue === null ? null : realValue - computed;
  // Début de la période que couvre l'écart : dernier mouvement ou dernière réconciliation connus.
  const since = lastKnownActivity(wallet, transactions, history);
  const sinceDays = Math.floor((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));

  async function reconcile() {
    setError(undefined);
    setMessage(undefined);
    if (realValue === null) return setError(t("errors.invalidAmount"));
    const motive = memo.trim() || (undetailed ? t("reconcile.undetailedMemo") : "");
    try {
      await reconcileWallet(id, realValue, motive, new Date(), undefined, cutoff, { undetailed });
      setReal("");
      setMemo("");
      setUndetailed(false);
      setMessage(t("reconcile.done"));
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">
        {t("reconcile.title", { name: wallet.name })}
      </PageTitle>
      <p>
        {t("reconcile.computed")} : <strong>{formatMoney(computed, currency)}</strong>
      </p>

      <Field label={`${t("reconcile.real")} (${currency})`}>
        <input
          inputMode="decimal"
          className={inputClass}
          value={real}
          onChange={(e) => setReal(e.target.value)}
        />
      </Field>
      <p className="text-sm text-neutral-600 dark:text-muted">
        {t("reconcile.since", { date: format(since, "dd/MM/yyyy"), days: Math.max(0, sinceDays) })}
      </p>
      {gap !== null ? (
        <p className="text-sm text-neutral-600 dark:text-muted">
          {gap === 0
            ? t("reconcile.noGap")
            : t("reconcile.gap", { amount: formatMoney(gap, currency) })}
        </p>
      ) : null}
      {gap !== null && gap !== 0 ? (
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={undetailed}
              onChange={(e) => setUndetailed(e.target.checked)}
            />
            <span className="text-sm">{t("reconcile.undetailed")}</span>
          </label>
          <p className="text-sm text-neutral-600 dark:text-muted">{t("reconcile.undetailedHint")}</p>
          <Link to="/transactions/new" className="inline-flex min-h-[44px] items-center underline">
            {t("reconcile.addMovement")}
          </Link>
        </div>
      ) : null}
      <Field label={t("reconcile.memo")}>
        <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        className={buttonPrimary}
        disabled={realValue === null}
        onClick={() => void reconcile()}
      >
        {t("reconcile.button")}
      </button>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("reconcile.history")}</h2>
        {history.length === 0 ? <p className="text-neutral-600 dark:text-muted">{t("reconcile.noHistory")}</p> : null}
        <ul className="flex flex-col gap-1 text-sm">
          {history.map((r) => (
            <li key={r.id} className="flex justify-between">
              <span>
                {format(new Date(r.date), "dd/MM/yyyy HH:mm")} ·{" "}
                {r.memo || t("reconcile.defaultMemo")}
              </span>
              <span>
                {formatMoney(r.realBalance, currency)} ({r.adjustment >= 0 ? "+" : ""}
                {formatMoney(r.adjustment, currency)})
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
