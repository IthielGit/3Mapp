import { useEffect, useRef, useState } from "react";
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
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  // Changer d'écran retire le bouton utilisé : sans cela, le focus est perdu et Tab sort de la page.
  // Le focus va donc au titre du nouvel écran.
  useEffect(() => {
    if (step > 0) stepTitleRef.current?.focus();
  }, [step]);

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
      {/* Barre : l'échelle (et non la largeur) passe d'une étape à l'autre, en douceur. */}
      <div
        role="progressbar"
        aria-label={t("onboarding.progress")}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={step}
        className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/15"
      >
        <div
          className="onb-progress-fill h-full w-full origin-left rounded-full bg-brand-600 dark:bg-fg"
          style={{ transform: `scaleX(${step / 2})` }}
        />
      </div>

      {step === 1 ? (
        <div className="onb-step flex flex-col gap-4">
          <h1 ref={stepTitleRef} tabIndex={-1} className="text-2xl font-semibold">{t("onboarding.settingsTitle")}</h1>
          <Field label={t("onboarding.language")}>
            <select
              className={inputClass}
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
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
        <div className="onb-step flex flex-col gap-4">
          <h1 ref={stepTitleRef} tabIndex={-1} className="text-2xl font-semibold">{t("onboarding.walletTitle")}</h1>
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
