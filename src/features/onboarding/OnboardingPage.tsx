import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { ColorPicker, IconPicker } from "../../components/Pickers";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { CURRENCIES, formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import { completeOnboarding } from "./onboarding-service";
import { PaySetupForm, type PayChoice } from "../cycle/PaySetupForm";
import { IntroScreen } from "./IntroScreen";
import type { Wallet } from "../../db/entities";
import type { AppLanguage } from "../../i18n";

const GROUPS: Wallet["group"][] = ["bank", "cash", "mobile", "savings", "credit_card"];

/**
 * Parcours court : une introduction, puis deux écrans (langue et devise, puis le compte et son solde).
 * Le jour de paie et les options du compte se règlent plus tard, dans Préférences et le compte.
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<AppLanguage>("fr");
  const [currency, setCurrency] = useState<CurrencyCode>("MGA");
  const [name, setName] = useState(() => t("onboarding.defaultWalletName"));
  const [group, setGroup] = useState<Wallet["group"]>("bank");
  const [icon, setIcon] = useState("🏦");
  const [color, setColor] = useState("#0B7E9D");
  const [balanceText, setBalanceText] = useState("0");
  const [pay, setPay] = useState<PayChoice | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Première étape : écran d'introduction sombre, puis les deux écrans de configuration.
  if (step === 0) return <IntroScreen onStart={() => setStep(1)} />;

  async function finish() {
    setError(undefined);
    if (name.trim() === "") return setNameError(t("errors.required"));
    const initialBalance = parseMoney(balanceText || "0", currency);
    if (initialBalance === null) return setError(t("errors.invalidAmount"));

    setSaving(true);
    try {
      await completeOnboarding({
        language,
        baseCurrency: currency,
        wallet: { name: name.trim(), icon, color, group, currency, initialBalance },
        ...(pay ? { pay } : {}),
      });
      await i18n.changeLanguage(language);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-6 py-6">
      <progress
        className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-neutral-200 dark:bg-white/15 [&::-moz-progress-bar]:bg-brand-600 [&::-webkit-progress-bar]:bg-neutral-200 [&::-webkit-progress-value]:bg-brand-600 dark:[&::-moz-progress-bar]:bg-fg dark:[&::-webkit-progress-value]:bg-fg"
        value={step}
        max={2}
        aria-label={t("onboarding.progress")}
      />

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t("onboarding.settingsTitle")}</h1>
          <Field label={t("onboarding.language")}>
            <select
              className={inputClass}
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="mg">Malagasy</option>
            </select>
          </Field>
          <Field label={t("onboarding.currency")}>
            <select
              className={inputClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.symbol}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t("onboarding.walletTitle")}</h1>
          <p className="text-neutral-600 dark:text-muted">{t("onboarding.balanceHint")}</p>
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
          <Field label={t("wallets.initialBalance")}>
            <input
              inputMode="decimal"
              className={inputClass}
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value)}
              placeholder={formatMoney(0, currency, { withSymbol: false })}
            />
          </Field>
          <PaySetupForm
            tone="page"
            monthStartDay={1}
            onChange={setPay}
          />
          <details className="flex flex-col gap-4">
            <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-neutral-600 underline dark:text-muted">
              {t("onboarding.customise")}
            </summary>
            <Field label={t("wallets.group")}>
              <select
                className={inputClass}
                value={group}
                onChange={(e) => setGroup(e.target.value as Wallet["group"])}
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {t(`groups.${g}`)}
                  </option>
                ))}
              </select>
            </Field>
            <IconPicker value={icon} onChange={setIcon} label={t("common.icon")} />
            <ColorPicker value={color} onChange={setColor} label={t("common.color")} />
          </details>
          {error ? (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        {step === 2 && name.trim() === "" ? (
          <p className="text-center text-sm text-neutral-600 dark:text-muted">
            {t("onboarding.nameRequired")}
          </p>
        ) : null}
        <div className="flex justify-between gap-3">
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            {t("common.previous")}
          </button>
          {step === 1 ? (
            <button type="button" className={buttonPrimary} onClick={() => setStep(2)}>
              {t("common.next")}
            </button>
          ) : (
            <button
              type="button"
              className={buttonPrimary}
              onClick={finish}
              disabled={saving || name.trim() === ""}
            >
              {t("onboarding.finish")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
