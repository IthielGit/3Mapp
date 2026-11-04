import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { ColorPicker, IconPicker } from "../../components/Pickers";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { CURRENCIES, formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import { completeOnboarding } from "./onboarding-service";
import { IntroScreen } from "./IntroScreen";
import type { Wallet } from "../../db/entities";
import type { AppLanguage } from "../../i18n";

const SLIDES = ["onboarding.slide1", "onboarding.slide2", "onboarding.slide3"] as const;
const GROUPS: Wallet["group"][] = ["bank", "cash", "mobile", "savings", "credit_card"];

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<AppLanguage>("fr");
  const [currency, setCurrency] = useState<CurrencyCode>("MGA");
  const [name, setName] = useState("");
  const [group, setGroup] = useState<Wallet["group"]>("bank");
  const [icon, setIcon] = useState("🏦");
  const [color, setColor] = useState("#0f766e");
  const [balanceText, setBalanceText] = useState("0");
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const SETUP_STEPS = 3;
  const totalSteps = SLIDES.length + SETUP_STEPS;

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
      });
      await i18n.changeLanguage(language);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  const isSlide = step < SLIDES.length;
  const slideKey = SLIDES[step];

  // Première étape : écran d'introduction sombre, puis le parcours de configuration.
  if (step === 0) return <IntroScreen onStart={() => setStep(1)} />;

  return (
    <section className="flex min-h-dvh flex-col gap-6 py-6">
      <progress
        className="w-full"
        value={step + 1}
        max={totalSteps}
        aria-label={t("onboarding.progress")}
      />

      {step === 0 ? (
        <Link to="/restore" className="text-sm font-medium text-brand-700 underline dark:text-fg">
          {t("onboarding.restoreLink")}
        </Link>
      ) : null}

      {isSlide && slideKey ? (
        <div className="flex flex-1 flex-col gap-3">
          <h1 className="text-2xl font-bold">{t(`${slideKey}.title`)}</h1>
          <p className="text-slate-600 dark:text-muted">{t(`${slideKey}.text`)}</p>
        </div>
      ) : null}

      {step === SLIDES.length ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t("onboarding.settingsTitle")}</h1>
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

      {step === SLIDES.length + 1 ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t("onboarding.walletTitle")}</h1>
          <p className="text-slate-600 dark:text-muted">{t("onboarding.walletHint")}</p>
          <Field label={t("common.name")} error={nameError}>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder={t("onboarding.walletPlaceholder")}
            />
          </Field>
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
        </div>
      ) : null}

      {step === SLIDES.length + 2 ? (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t("onboarding.balanceTitle")}</h1>
          <Field label={t("wallets.initialBalance")}>
            <input
              inputMode="decimal"
              className={inputClass}
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value)}
              placeholder={formatMoney(0, currency, { withSymbol: false })}
            />
          </Field>
          <IconPicker value={icon} onChange={setIcon} label={t("common.icon")} />
          <ColorPicker value={color} onChange={setColor} label={t("common.color")} />
          {error ? (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex justify-between gap-3">
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          {t("common.previous")}
        </button>
        {step < totalSteps - 1 ? (
          <button type="button" className={buttonPrimary} onClick={() => setStep((s) => s + 1)}>
            {t("common.next")}
          </button>
        ) : (
          <button type="button" className={buttonPrimary} onClick={finish} disabled={saving}>
            {t("onboarding.finish")}
          </button>
        )}
      </div>
    </section>
  );
}
