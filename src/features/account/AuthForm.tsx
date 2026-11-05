import { useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../components/BrandMark";
import {
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AccountResult,
} from "./account-service";

type Mode = "signIn" | "signUp";

/** Adresse de retour après connexion (autorisée dans Supabase, voir SUPABASE_GOOGLE_SETUP). */
export function accountRedirectUrl(): string {
  return `${window.location.origin}/plus/account`;
}

const fieldClass =
  "h-11 w-full rounded-2xl border border-neutral-300 bg-neutral-50 px-4 text-base text-ink placeholder:text-neutral-500 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/15 dark:bg-raised dark:text-fg dark:focus:bg-raised";

/** Champ avec libellé au-dessus, comme sur les écrans de connexion modernes. */
function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink dark:text-fg">{label}</span>
      {children}
    </label>
  );
}

/**
 * Écran de connexion obligatoire : zone d'accueil avec la marque, puis carte de formulaire.
 * Connexion et inscription partagent le même écran ; l'inscription ajoute la confirmation du mot de passe.
 */
export function AuthForm({ client }: { client: SupabaseClient }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  function switchMode(next: Mode) {
    setMode(next);
    setError(undefined);
    setNotice(undefined);
    setConfirm("");
  }

  async function run(action: () => Promise<AccountResult>, success?: string) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      if (success) setNotice(success);
      setPassword("");
      setConfirm("");
    } else {
      setError(t(`account.errors.${result.code}`));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signUp") {
      if (password !== confirm) {
        setError(t("account.passwordMismatch"));
        return;
      }
      void run(() => signUpWithEmail(client, email, password, accountRedirectUrl()), t("account.checkEmail"));
    } else {
      void run(() => signInWithEmail(client, email, password));
    }
  }

  const isSignUp = mode === "signUp";

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-brand-50 via-canvas to-canvas dark:from-raised dark:via-canvas dark:to-canvas">
      {/* Zone d'accueil : marque et promesse, sans photo ni illustration externe. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-200/60 dark:bg-brand-dark/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-10 top-24 h-24 w-24 rounded-full bg-brand-300/40 dark:bg-brand-dark/10" />
      <header className="relative flex flex-col items-center gap-1.5 px-6 pb-2 pt-6 text-center [@media(max-height:720px)]:hidden">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md dark:bg-card">
          <BrandMark size={32} />
        </div>
        <p className="text-2xl font-semibold text-ink dark:text-fg">Fundora</p>
        <p className="max-w-xs text-xs text-neutral-600 dark:text-muted">{t("account.gate.tagline")}</p>
      </header>

      <section className="relative mx-auto mt-auto w-full max-w-md rounded-t-[2rem] bg-white px-6 pb-4 pt-5 shadow-[0_-8px_30px_rgba(11,18,32,0.08)] dark:bg-card">
        <div className="mb-3 flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold text-ink dark:text-fg">
            {isSignUp ? t("account.screen.createTitle") : t("account.screen.welcomeTitle")}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-muted [@media(max-height:720px)]:hidden">
            {isSignUp ? t("account.screen.createSub") : t("account.screen.welcomeSub")}
          </p>
        </div>

        <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1 dark:bg-raised">
          {(["signIn", "signUp"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => switchMode(item)}
              className={
                mode === item
                  ? "min-h-[40px] rounded-full bg-white font-semibold text-ink shadow-sm dark:bg-card dark:text-fg"
                  : "min-h-[40px] rounded-full font-medium text-neutral-600 dark:text-muted"
              }
            >
              {item === "signIn" ? t("account.signIn") : t("account.signUp")}
            </button>
          ))}
        </div>

        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
          <LabeledField label={t("account.email")}>
            <input
              type="email"
              autoComplete="email"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </LabeledField>

          <LabeledField label={t("account.password")}>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className={`${fieldClass} pr-24`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-4 text-sm font-medium text-brand-700 dark:text-brand-dark"
                aria-label={showPassword ? t("account.hidePassword") : t("account.showPassword")}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? t("account.hide") : t("account.show")}
              </button>
            </span>
          </LabeledField>

          {isSignUp ? (
            <>
              <LabeledField label={t("account.confirmPassword")}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={fieldClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </LabeledField>
              <p className="text-sm text-neutral-600 dark:text-muted">{t("account.passwordHint")}</p>
            </>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                className="min-h-[44px] text-sm font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-dark"
                disabled={busy}
                onClick={() => void run(() => sendPasswordReset(client, email, accountRedirectUrl()), t("account.resetSent"))}
              >
                {t("account.forgotPassword")}
              </button>
            </div>
          )}

          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="min-h-[46px] rounded-full bg-brand-600 font-semibold text-white shadow-md shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-dark dark:text-ink"
          >
            {isSignUp ? t("account.createButton") : t("account.signInButton")}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-500">
          <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
          {t("account.or")}
          <span className="h-px flex-1 bg-neutral-200 dark:bg-white/10" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => signInWithGoogle(client, accountRedirectUrl()))}
          className="flex min-h-[46px] w-full items-center justify-center gap-3 rounded-full border border-neutral-300 bg-white font-medium text-ink hover:bg-neutral-50 disabled:opacity-50 dark:border-white/15 dark:bg-raised dark:text-fg"
        >
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-ink dark:bg-card dark:text-fg">
            G
          </span>
          {t("account.google")}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-600 dark:text-muted">
          {isSignUp ? t("account.haveAccount") : t("account.noAccount")}{" "}
          <button
            type="button"
            className="min-h-[44px] font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-dark"
            onClick={() => switchMode(isSignUp ? "signIn" : "signUp")}
          >
            {isSignUp ? t("account.signIn") : t("account.signUp")}
          </button>
        </p>
      </section>
    </main>
  );
}
