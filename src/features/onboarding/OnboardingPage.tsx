import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ColorPicker, IconPicker } from "../../components/Pickers";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { LogoTile } from "../../components/LogoTile";
import { CURRENCIES, formatMoney, parseMoney, type CurrencyCode } from "../../lib/money";
import { completeOnboarding } from "./onboarding-service";
import { PaySetupForm, type PayChoice } from "../cycle/PaySetupForm";
import { useAccount } from "../account/AccountProvider";
import { accountIdentity } from "../account/account-identity";
import { signOutAndClear } from "../account/sign-out";
import type { Wallet } from "../../db/entities";

const GROUPS: Wallet["group"][] = ["bank", "cash", "mobile", "savings", "credit_card"];

/** Destination demandée avant l'onboarding (transmise par RequireOnboarding), sinon l'accueil. */
interface Destination {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Parcours court, sans écran d'introduction : l'écran de connexion en a déjà fait office.
 * La langue vient de l'écran de connexion. Deux étapes : la devise, puis le premier portefeuille.
 * Le jour de paie et les options du portefeuille se règlent plus tard, dans Préférences et le compte.
 */
export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const account = useAccount();
  const language = i18n.resolvedLanguage === "en" ? "en" : "fr";
  const from = (location.state as { from?: Destination } | null)?.from;
  const [step, setStep] = useState(0);
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
  const [signingOut, setSigningOut] = useState(false);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);
  // Changer d'écran retire le bouton utilisé : sans cela, le focus est perdu et Tab sort de la page.
  // Le focus va donc au titre du nouvel écran.
  useEffect(() => {
    if (step > 0) stepTitleRef.current?.focus();
  }, [step]);

  const identityLabel =
    account.status === "signedIn"
      ? accountIdentity(account.session.user).name || account.session.user.email
      : undefined;

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
      navigate(from ? `${from.pathname}${from.search}${from.hash}` : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  /** Mauvais compte : on ferme la session, l'écran de connexion reprend la main. */
  async function signOut() {
    if (account.status !== "signedIn") return;
    setSigningOut(true);
    await signOutAndClear(account.client);
    setSigningOut(false);
  }

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 bg-canvas px-6 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] dark:bg-page">
      <header className="flex items-center gap-3">
        <LogoTile />
        <p className="text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-dark">{t("app.title")}</p>
      </header>

      {identityLabel ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-[0_8px_24px_rgba(20,40,50,0.06)] dark:bg-card">
          <span className="min-w-0">
            <span className="block text-neutral-600 dark:text-muted">{t("onboarding.signedInAs")}</span>
            <span className="block truncate font-medium text-ink dark:text-fg">{identityLabel}</span>
          </span>
          <button
            type="button"
            className="min-h-[44px] shrink-0 font-medium text-brand-700 underline underline-offset-4 disabled:opacity-50 dark:text-brand-dark"
            disabled={signingOut || saving}
            onClick={() => void signOut()}
          >
            {t("onboarding.notYou")}
          </button>
        </div>
      ) : null}

      {/* Barre : deux étapes, l'échelle (et non la largeur) passe d'une étape à l'autre, en douceur. */}
      <div
        role="progressbar"
        aria-label={t("onboarding.progress")}
        aria-valuemin={1}
        aria-valuemax={2}
        aria-valuenow={step + 1}
        className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/15"
      >
        <div
          className="onb-progress-fill h-full w-full origin-left rounded-full bg-brand-600 dark:bg-fg"
          style={{ transform: `scaleX(${(step + 1) / 2})` }}
        />
      </div>

      {step === 0 ? (
        <div className="onb-step flex flex-col gap-4">
          <h1 ref={stepTitleRef} tabIndex={-1} className="text-2xl font-semibold">{t("onboarding.currencyTitle")}</h1>
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

      {step === 1 ? (
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
          <PaySetupForm tone="page" monthStartDay={1} onChange={setPay} />
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
        {step === 1 && name.trim() === "" ? (
          <p className="text-center text-sm text-neutral-600 dark:text-muted">
            {t("onboarding.nameRequired")}
          </p>
        ) : null}
        <div className="flex justify-between gap-3">
          {step > 0 ? (
            <button type="button" className={buttonSecondary} onClick={() => setStep(0)}>
              {t("common.previous")}
            </button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <button type="button" className={buttonPrimary} onClick={() => setStep(1)}>
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
