import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
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
  "h-12 w-full rounded-xl border-0 bg-neutral-100 px-4 pr-12 text-base text-ink placeholder:text-neutral-500 transition-shadow duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-brand-600 dark:bg-raised dark:text-fg dark:focus:ring-brand-dark";

/** Bouton principal : pleine largeur, retour tactile immédiat, survol seulement sur appareils qui survolent. */
const primaryButtonClass =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white shadow-md shadow-brand-600/25 transition-[transform,background-color] duration-150 ease-out [@media(hover:hover)]:hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 dark:bg-brand-dark dark:text-ink";

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}

/** Logo P-jauge officiel de Google (quatre couleurs de la marque, à vérifier contre les directives de marque). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Tuile du logo : repère en jauge (arc et point cyan) sur fond charbon, variante sombre de la charte. */
function LogoTile() {
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[linear-gradient(160deg,#1F2937,#0B1220)] shadow-md shadow-[#0B1220]/25">
      <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 12 A20 20 0 1 1 12 32" fill="none" stroke="#F4F6F7" strokeWidth="6" strokeLinecap="round" />
        <circle cx="12" cy="32" r="4.5" fill="#10B0DC" stroke="#0B1220" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

/** Icône œil ; barrée quand le mot de passe est affiché. Zone tactile de 44 px. */
function VisibilityToggle({ shown, label, onToggle }: { shown: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-muted"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {shown ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
      </svg>
    </button>
  );
}

/** Champ avec libellé au-dessus, action optionnelle à droite du libellé. */
function Field({ id, label, action, children }: { id: string; label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[24px] items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink dark:text-fg">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * Écran de connexion obligatoire, selon la maquette validée : logo et nom en haut, carte blanche centrée,
 * champs gris, bouton principal, puis connexion Google. L'inscription est un second écran (retour en haut à gauche).
 */
export function AuthForm({ client }: { client: SupabaseClient }) {
  const { t } = useTranslation();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
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
  const showLabel = showPassword ? t("account.hidePassword") : t("account.showPassword");

  return (
    <main className="relative flex h-dvh flex-col overflow-y-auto bg-canvas dark:bg-page">
      {notice ? (
        <p
          role="status"
          className="auth-drop fixed inset-x-4 top-3 z-20 mx-auto max-w-md rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 shadow-lg dark:border-brand-dark/30 dark:bg-raised dark:text-fg"
        >
          {notice}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-start">
          {isSignUp ? (
            <button
              type="button"
              aria-label={t("account.screen.backAria")}
              onClick={() => switchMode("signIn")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 bg-white text-ink focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-white/15 dark:bg-card dark:text-fg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col items-center gap-2">
            <LogoTile />
            <p className="text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-dark">Fundora</p>
          </div>
          <span />
        </div>

        <section className="intro-stagger my-auto rounded-3xl bg-white px-[22px] pb-6 pt-7 shadow-[0_8px_24px_rgba(20,40,50,0.06)] dark:bg-card">
          <h1 key={`title-${mode}`} className="auth-swap mb-6 text-center text-[22px] font-semibold leading-tight text-ink dark:text-fg">
            {isSignUp ? t("account.screen.createTitle") : t("account.screen.signInTitle")}
          </h1>

          <form key={mode} className="auth-swap flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Field id={emailId} label={t("account.email")}>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field
              id={passwordId}
              label={t("account.password")}
              action={
                isSignUp ? null : (
                  <button
                    type="button"
                    className="min-h-[24px] text-sm font-medium text-brand-700 underline-offset-4 [@media(hover:hover)]:hover:underline disabled:opacity-50 dark:text-brand-dark"
                    disabled={busy}
                    onClick={() => void run(() => sendPasswordReset(client, email, accountRedirectUrl()), t("account.resetSent"))}
                  >
                    {t("account.forgotPassword")}
                  </button>
                )
              }
            >
              <span className="relative block">
                <input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className={fieldClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <VisibilityToggle shown={showPassword} label={showLabel} onToggle={() => setShowPassword((v) => !v)} />
              </span>
            </Field>

            {isSignUp ? (
              <Field id={confirmId} label={t("account.confirmPassword")}>
                <span className="relative block">
                  <input
                    id={confirmId}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className={fieldClass}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  <VisibilityToggle shown={showPassword} label={showLabel} onToggle={() => setShowPassword((v) => !v)} />
                </span>
              </Field>
            ) : null}

            {/* Ligne d'erreur toujours présente : l'apparition d'un message ne décale pas le bouton. */}
            <p key={error ?? ""} role="alert" className="auth-fade -my-1 min-h-5 text-sm text-red-700 dark:text-red-400">
              {error ?? ""}
            </p>

            <button type="submit" disabled={busy} aria-busy={busy} className={primaryButtonClass}>
              {busy ? <Spinner /> : null}
              {isSignUp ? t("account.createButton") : t("account.signInButton")}
            </button>
          </form>

          <p className="my-5 text-center text-sm text-neutral-600 dark:text-muted">
            {isSignUp ? t("account.screen.orSignUp") : t("account.screen.orSignIn")}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => signInWithGoogle(client, accountRedirectUrl()))}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white font-medium text-ink transition-[transform,background-color] duration-150 ease-out [@media(hover:hover)]:hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-60 dark:border-white/15 dark:bg-raised dark:text-fg"
          >
            <GoogleMark />
            {t("account.google")}
          </button>
        </section>

        {isSignUp ? null : (
          <p className="mt-6 text-center text-sm text-ink dark:text-fg">
            {t("account.screen.noAccount")}{" "}
            <button
              type="button"
              onClick={() => switchMode("signUp")}
              className="font-semibold text-brand-700 underline-offset-4 [@media(hover:hover)]:hover:underline dark:text-brand-dark"
            >
              {t("account.screen.createTitle")}
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
