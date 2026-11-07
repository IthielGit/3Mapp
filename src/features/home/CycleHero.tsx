import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import type { PayStatus } from "../../domain/cycle";
import { homeNextStep } from "../../domain/homeNextStep";
import { gaugeGeometry, keptPercent, remainingShare } from "../../domain/month-gauge";
import { db } from "../../db/database";
import { formatMoney } from "../../lib/money";
import { heroAmountClass } from "../../lib/amount-fit";
import { Icon } from "../../components/Icon";
import { BottomSheet } from "../../components/BottomSheet";
import { announce } from "../../components/announce";
import { updatePreferences, type PreferencePatch } from "../settings/preferences-service";
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

/** Bouton blanc de la carte : l'action unique d'une étape. */
const STEP_ACTION =
  "inline-flex min-h-[44px] items-center self-start rounded-xl bg-white px-4 font-semibold text-brand-900";

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
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  // Dernière réponse à la question de paie, annulable tant que la carte reste affichée.
  const [undo, setUndo] = useState<{ message: string; restore: PreferencePatch } | null>(null);
  // Lu ici plutôt que dans useHomeData : seule la carte a besoin du refus de la suggestion.
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
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

  // Une seule étape à la fois (soldes de départ, première saisie, puis paie).
  const computedStep = homeNextStep({
    wallets: active,
    transactionCount: transactions.length,
    payMode: settings?.payMode,
    payIncomeCategoryId: settings?.payIncomeCategoryId,
    suggestedPayDate: cycleView.suggestedPay?.date.toISOString(),
    paySuggestionDismissedAt: settings?.paySuggestionDismissedAt,
  });
  // Tant que les réglages ne sont pas lus, la paie n'est pas demandée : une suggestion déjà
  // refusée ne doit pas réapparaître le temps du chargement.
  const step =
    settings === undefined && (computedStep === "pay" || computedStep === "paySuggestion")
      ? "none"
      : computedStep;
  const firstRun = step === "startBalance" || step === "firstEntry";

  /** Enregistre une réponse de paie, l'annonce, et garde les valeurs d'avant pour « Annuler ». */
  async function answerPay(patch: PreferencePatch, message: string) {
    const restore: PreferencePatch = {};
    for (const key of Object.keys(patch) as (keyof PreferencePatch)[]) {
      Object.assign(restore, { [key]: settings?.[key] });
    }
    await updatePreferences(patch);
    setUndo({ message, restore });
    announce(message);
  }

  async function runUndo() {
    if (!undo) return;
    await updatePreferences(undo.restore);
    setUndo(null);
    announce(t("home.onboard.undone"));
  }

  /** « C'est votre paie ? » : seule la catégorie est enregistrée, le jour de paie reste celui réglé. */
  async function acceptSuggestedPay(categoryId: string, category: string) {
    await answerPay(
      { payIncomeCategoryId: categoryId, payMode: "fixed" },
      t("home.onboard.payAccepted", { category }),
    );
  }

  /** « Non » est mémorisé : l'entrée refusée n'est plus proposée (règle dans domain/homeNextStep). */
  async function dismissSuggestion() {
    await updatePreferences({ paySuggestionDismissedAt: new Date().toISOString() });
    announce(t("home.onboard.suggestionDismissed"));
  }

  /** Réponse donnée dans la feuille : le jour de paie et la catégorie de revenu sont enregistrés ensemble. */
  async function savePaySetup(choice: PayChoice) {
    const patch: PreferencePatch =
      choice.mode === "fixed"
        ? {
            monthStartDay: choice.day,
            payMode: "fixed",
            ...(choice.categoryId ? { payIncomeCategoryId: choice.categoryId } : {}),
          }
        : { payMode: choice.mode };
    await answerPay(patch, t("home.onboard.paySaved"));
    setPaySheetOpen(false);
  }

  const day = (d: Date) => format(d, "d MMM", { locale: cycleLocale });
  const availableText = formatMoney(cycle.available, baseCurrency);

  /** Question de paie sans réponse : la suggestion « C'est votre paie ? », ou une ligne qui ouvre la feuille. */
  function payQuestion() {
    const suggestion = cycleView.suggestedPay;
    if (step === "paySuggestion" && suggestion) {
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
              onClick={() => void acceptSuggestedPay(suggestion.categoryId, category)}
            >
              {t("cycle.yes")}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-white/70 font-medium text-white"
              onClick={() => void dismissSuggestion()}
            >
              {t("cycle.no")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-3">
        <p>{t("home.onboard.payPrompt")}</p>
        <button
          type="button"
          className="min-h-[44px] shrink-0 rounded-xl bg-white px-4 font-semibold text-brand-900"
          aria-haspopup="dialog"
          onClick={() => setPaySheetOpen(true)}
        >
          {t("home.onboard.payAnswer")}
        </button>
      </div>
    );
  }

  /** État de la paie une fois la question réglée (revenu choisi). */
  function payLine(pay: PayStatus) {
    switch (pay.kind) {
      case "unset":
        return null;
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

  const monthGauge = gaugeGeometry(remainingShare(cycle.income, cycle.expense));
  const keptShare = keptPercent(cycle.income, cycle.expense);

  const payContent =
    step === "pay" || step === "paySuggestion"
      ? payQuestion()
      : !firstRun && !(cycleView.pay.kind === "unset" && payAnswered)
        ? payLine(cycleView.pay)
        : null;

  return (
    <section
      aria-labelledby="cycle-title"
      className="relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-sm"
    >
      <h2 id="cycle-title" className="text-xs font-medium">
        {t("cycle.title", {
          from: format(cycle.period.from, "d MMM", { locale: cycleLocale }),
          to: format(cycleLastDay, "d MMM", { locale: cycleLocale }),
        })}
      </h2>

      {step === "startBalance" ? (
        // Premier lancement, comptes à 0 : on demande le solde de départ au lieu d'afficher « 0 Ar ».
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">{t("home.onboard.startBalance")}</p>
          <Link to="/plus/wallets" className={STEP_ACTION}>
            {t("cycle.setStartBalances")}
          </Link>
        </div>
      ) : noStartBalance ? (
        // Sans solde de départ, un découvert n'a pas de sens : on demande le solde au lieu d'un montant négatif.
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">{t("cycle.noStartBalance")}</p>
          <Link to="/plus/wallets" className={STEP_ACTION}>
            {t("cycle.setStartBalances")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs">{t("cycle.available")}</p>
          <p className={`${heroAmountClass(availableText)} font-semibold leading-none tracking-tight tabular-nums`} data-amount>
            {availableText}
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

      {step === "firstEntry" ? (
        // Soldes connus, rien de saisi : une seule action, pas de « Reste du mois : 0 Ar ».
        <div className="flex flex-col gap-3 border-t border-white/20 pt-3">
          <p className="text-sm">{t("home.onboard.firstEntry")}</p>
          <Link to="/transactions/new" className={STEP_ACTION}>
            {t("home.onboard.firstEntryAction")}
          </Link>
        </div>
      ) : step !== "startBalance" ? (
        // Ce qui reste du mois, ou le dépassement.
        <div className="flex flex-col gap-2 border-t border-white/20 pt-3">
          <div className="flex items-center gap-3">
            {/* Jauge de la marque : le point marque la part restante du revenu. Le texte la décrit déjà. */}
            <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0" aria-hidden="true" focusable="false">
              <path d={monthGauge.track} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round" />
              {monthGauge.fill ? (
                <path d={monthGauge.fill} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              ) : null}
              {monthGauge.dot ? <circle cx={monthGauge.dot.x} cy={monthGauge.dot.y} r="3.5" fill="currentColor" /> : null}
            </svg>
            {/* Le montant d'abord, puis ce qu'il veut dire ; le pourcentage relie le texte à la jauge. */}
            <div className="flex min-w-0 flex-col">
              <p className="text-lg font-semibold" data-amount>
                {formatMoney(cycle.saved, baseCurrency)}
              </p>
              <p className="text-xs">
                {cycle.saved < 0
                  ? t("cycle.spentMore")
                  : keptShare === null
                    ? t("cycle.savedNoIncome")
                    : t("cycle.saved", { percent: keptShare })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* La question de paie, en une ligne sur la carte ; le formulaire s'ouvre dans une feuille. */}
      {payContent ? <div className="rounded-2xl bg-brand-900/40 p-3 text-sm">{payContent}</div> : null}

      {undo ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-900/40 p-3 text-sm">
          <p>{undo.message}</p>
          <button
            type="button"
            className="min-h-[44px] shrink-0 px-2 font-semibold underline"
            onClick={() => void runUndo()}
          >
            {t("common.undo")}
          </button>
        </div>
      ) : null}

      {/* Détail replié : comptes pris en compte, entrées, sorties et versements. Masqué tant que tout vaut 0. */}
      {firstRun ? null : (
        <details className="group flex flex-col gap-3 border-t border-white/20 pt-3">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-xs font-medium [&::-webkit-details-marker]:hidden">
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
          {/* Collée au titre : la zone tactile du lien « Modifier » fait déjà la marge. */}
          <p className="-mt-3 text-xs">
            {countedList.length <= 2
              ? t("cycle.accounts", { names: countedNames || "—" })
              : t("cycle.accountsCount", { count: countedList.length })}{" "}
            <Link to="/plus/wallets" className="inline-flex min-h-[44px] items-center underline">
              {t("cycle.editAccounts")}
            </Link>
          </p>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <div className="flex flex-col gap-0.5">
              <dt className="inline-flex items-center justify-center gap-1 text-xs">
                <Icon name="plus" className="h-3 w-3" />
                {t("cycle.income")}
              </dt>
              <dd className="text-sm font-semibold tabular-nums" data-amount>
                {formatMoney(cycle.income, baseCurrency)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="inline-flex items-center justify-center gap-1 text-xs">
                <Icon name="minus" className="h-3 w-3" />
                {t("cycle.expense")}
              </dt>
              <dd className="text-sm font-semibold tabular-nums" data-amount>
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
            <p className="text-xs">
              {t("cycle.plannedSaving", { amount: formatMoney(cycleView.plannedSaving, baseCurrency) })}
            </p>
          ) : null}
        </details>
      )}

      <BottomSheet open={paySheetOpen} title={t("home.onboard.paySheetTitle")} onClose={() => setPaySheetOpen(false)}>
        <PaySetupForm
          tone="page"
          monthStartDay={monthStartDay}
          categories={incomeCategories}
          submitLabel={t("cycle.paySetupSave")}
          onSave={savePaySetup}
        />
      </BottomSheet>
    </section>
  );
}
