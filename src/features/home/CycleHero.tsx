import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import type { PayStatus } from "../../domain/cycle";
import { formatMoney } from "../../lib/money";
import { updatePreferences } from "../settings/preferences-service";
import { PaySetupForm, type PayChoice } from "../cycle/PaySetupForm";
import type { HomeData } from "./useHomeData";

type CycleHeroProps = Pick<
  HomeData,
  | "cycleView"
  | "baseCurrency"
  | "categories"
  | "incomeCategories"
  | "active"
  | "transactions"
  | "payAnswered"
  | "monthStartDay"
>;

/** Votre mois : la seule carte colorée. Elle répond d'abord à « combien ai-je ? ». */
export function CycleHero({
  cycleView,
  baseCurrency,
  categories,
  incomeCategories,
  active,
  transactions,
  payAnswered,
  monthStartDay,
}: CycleHeroProps) {
  const { t, i18n } = useTranslation();
  const [suggestionHidden, setSuggestionHidden] = useState(false);
  const cycle = cycleView.summary;
  // Les comptes comptés dans « Disponible » sont nommés, pour que l'utilisateur sache ce qui est inclus.
  const countedList = active
    .filter((w) => w.includeInTotal && w.group !== "savings")
    .map((w) => w.name);
  const countedNames = countedList.join(", ");
  const cycleLocale = i18n.language.startsWith("en") ? enUS : fr;
  const cycleLastDay = new Date(cycle.period.to.getTime() - 1);
  const noStartBalance =
    cycle.available < 0 &&
    active.filter((w) => w.includeInTotal && w.group !== "savings").every((w) => w.initialBalance === 0);

  /** « C'est votre paie ? » : seule la catégorie est enregistrée, le jour de paie reste celui réglé. */
  async function acceptSuggestedPay(categoryId: string) {
    await updatePreferences({ payIncomeCategoryId: categoryId, payMode: "fixed" });
  }

  /** Question de paie sans suggestion : le jour de paie et la catégorie de revenu sont enregistrés ensemble. */
  async function savePaySetup(choice: PayChoice) {
    if (choice.mode === "fixed") {
      await updatePreferences({
        monthStartDay: choice.day,
        payMode: "fixed",
        ...(choice.categoryId ? { payIncomeCategoryId: choice.categoryId } : {}),
      });
      return;
    }
    await updatePreferences({ payMode: choice.mode });
  }

  // La question de paie vit sur la carte colorée : texte blanc, boutons blanc et contour.
  function payLine(pay: PayStatus) {
    const day = (d: Date) => format(d, "d MMM", { locale: cycleLocale });
    switch (pay.kind) {
      case "unset": {
        const suggestion = cycleView.suggestedPay;
        if (suggestion && !suggestionHidden) {
          const category = categories.find((c) => c.id === suggestion.categoryId)?.name ?? "";
          return (
            <div className="flex flex-col gap-3">
              <p>
                {t("cycle.lastEntry", {
                  amount: formatMoney(suggestion.amount, baseCurrency),
                  date: day(suggestion.date),
                  category,
                })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl bg-white font-semibold text-brand-900"
                  onClick={() => void acceptSuggestedPay(suggestion.categoryId)}
                >
                  {t("cycle.yes")}
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl border border-white/40 font-medium text-white"
                  onClick={() => setSuggestionHidden(true)}
                >
                  {t("cycle.no")}
                </button>
              </div>
            </div>
          );
        }
        return (
          <Link to="/plus" className="inline-flex min-h-[44px] items-center underline">
            {t("cycle.paySet")}
          </Link>
        );
      }
      case "received":
        return (
          <p>
            {t("cycle.payReceived", {
              amount: formatMoney(pay.amount, baseCurrency),
              date: day(pay.date),
            })}
          </p>
        );
      case "expected":
        return (
          <p>
            {t("cycle.payExpected", { date: day(pay.date) })} ·{" "}
            <Link to="/transactions/new" className="underline">
              {t("cycle.addPay")}
            </Link>
          </p>
        );
      case "late":
        return (
          <p>
            {t("cycle.payLate", { days: pay.daysLate })} ·{" "}
            <Link to="/transactions/new" className="underline">
              {t("cycle.addPay")}
            </Link>
          </p>
        );
    }
  }

  return (
    <section
      aria-labelledby="cycle-title"
      className="relative flex flex-col gap-3 overflow-hidden rounded-3xl p-5 text-white shadow-lg"
      style={{ background: "linear-gradient(150deg, #0B7E9D 0%, #075064 100%)" }}
    >
      <h2 id="cycle-title" className="text-xs font-medium text-teal-50">
        {t("cycle.title", {
          from: format(cycle.period.from, "d MMM", { locale: cycleLocale }),
          to: format(cycleLastDay, "d MMM", { locale: cycleLocale }),
        })}
      </h2>

      {noStartBalance ? (
        // Sans solde de départ, un découvert n'a pas de sens : on demande le solde au lieu d'un montant négatif.
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">{t("cycle.noStartBalance")}</p>
          <Link
            to="/plus/wallets"
            className="inline-flex min-h-[44px] items-center self-start rounded-xl bg-white px-4 font-semibold text-brand-900"
          >
            {t("cycle.setStartBalances")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-teal-50">{t("cycle.available")}</p>
          <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums" data-amount>
            {formatMoney(cycle.available, baseCurrency)}
          </p>
          {cycle.available < 0 ? (
            <p className="pt-1 text-sm">
              {t("cycle.negativeBalance")}{" "}
              <Link to="/plus/wallets" className="inline-flex min-h-[44px] items-center underline">
                {t("cycle.checkAccounts")}
              </Link>
            </p>
          ) : null}
        </div>
      )}

      {/* Phrase du jour, ou dépassement, puis l'épargne du mois. */}
      <div className="flex flex-col gap-2 border-t border-white/20 pt-3">
        {transactions.length === 0 ? <p className="text-sm text-teal-50">{t("cycle.empty")}</p> : null}
        <p className="text-sm text-teal-50">
          {cycle.saved >= 0
            ? t("cycle.saved", { amount: formatMoney(cycle.saved, baseCurrency) })
            : t("cycle.spentMore", { amount: formatMoney(-cycle.saved, baseCurrency) })}
        </p>
      </div>

      {/* La question de paie, en une ligne sur la carte. */}
      {cycleView.pay.kind === "unset" && payAnswered ? null : cycleView.pay.kind === "unset" &&
        !(cycleView.suggestedPay && !suggestionHidden) ? (
        <PaySetupForm
          tone="hero"
          monthStartDay={monthStartDay}
          categories={incomeCategories}
          submitLabel={t("cycle.paySetupSave")}
          onSave={savePaySetup}
        />
      ) : (
        <div className="rounded-2xl bg-white/15 p-3 text-sm">{payLine(cycleView.pay)}</div>
      )}

      {/* Détail replié : comptes pris en compte, entrées, sorties et versements. */}
      <details className="group flex flex-col gap-3 border-t border-white/20 pt-3">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-xs font-medium text-teal-50 [&::-webkit-details-marker]:hidden">
          {t("cycle.thisMonth")}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 20 20"
            className="h-4 w-4 transition-transform duration-200 ease-out-strong group-open:rotate-180 motion-reduce:transition-none"
          >
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p className="text-xs text-teal-50">
          {countedList.length <= 2
            ? t("cycle.accounts", { names: countedNames || "—" })
            : t("cycle.accountsCount", { count: countedList.length })}{" "}
          <Link to="/plus/wallets" className="inline-flex min-h-[44px] items-center underline">
            {t("cycle.editAccounts")}
          </Link>
        </p>
        <dl className="grid grid-cols-2 gap-2 text-center">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-teal-50">{t("cycle.income")}</dt>
            <dd className="text-sm font-semibold tabular-nums text-emerald-200" data-amount>
              {formatMoney(cycle.income, baseCurrency)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-teal-50">{t("cycle.expense")}</dt>
            <dd className="text-sm font-semibold tabular-nums text-rose-200" data-amount>
              {formatMoney(cycle.expense, baseCurrency)}
            </dd>
          </div>
        </dl>
        {cycle.savedToGoals > 0 ? (
          <p className="text-sm">{t("cycle.savedToGoals", { amount: formatMoney(cycle.savedToGoals, baseCurrency) })}</p>
        ) : null}
        {cycle.debtsPaid > 0 ? (
          <p className="text-sm">{t("cycle.debtsPaid", { amount: formatMoney(cycle.debtsPaid, baseCurrency) })}</p>
        ) : null}
        {cycleView.plannedSaving !== undefined ? (
          <p className="text-xs text-teal-50">
            {t("cycle.plannedSaving", { amount: formatMoney(cycleView.plannedSaving, baseCurrency) })}
          </p>
        ) : null}
      </details>
    </section>
  );
}
