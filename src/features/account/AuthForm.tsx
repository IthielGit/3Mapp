import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { buttonPrimary, buttonSecondary, Field, inputClass } from "../../components/FormControls";
import {
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AccountErrorCode,
  type AccountResult,
} from "./account-service";

type Mode = "signIn" | "signUp";

/** Adresse de retour après connexion (autorisée dans Supabase, voir SUPABASE_GOOGLE_SETUP). */
export function accountRedirectUrl(): string {
  return `${window.location.origin}/plus/account`;
}

/**
 * Formulaire de connexion et d'inscription (e-mail, mot de passe, Google, mot de passe oublié).
 * Utilisé à l'écran de connexion obligatoire : sans compte, rien d'autre n'est accessible.
 */
export function AuthForm({ client }: { client: SupabaseClient }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountErrorCode | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  async function run(action: () => Promise<AccountResult>, success?: string) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      if (success) setNotice(success);
      setPassword("");
    } else {
      setError(result.code);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signUp") {
      void run(() => signUpWithEmail(client, email, password, accountRedirectUrl()), t("account.checkEmail"));
    } else {
      void run(() => signInWithEmail(client, email, password));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signIn"}
          className={mode === "signIn" ? buttonPrimary : buttonSecondary}
          onClick={() => setMode("signIn")}
        >
          {t("account.signIn")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signUp"}
          className={mode === "signUp" ? buttonPrimary : buttonSecondary}
          onClick={() => setMode("signUp")}
        >
          {t("account.signUp")}
        </button>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <Field label={t("account.email")}>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t("account.password")}>
          <input
            type="password"
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {mode === "signUp" ? (
          <p className="text-sm text-neutral-600 dark:text-muted">{t("account.passwordHint")}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-400">{t(`account.errors.${error}`)}</p>
        ) : null}
        {notice ? (
          <p role="status" className="text-emerald-700 dark:text-emerald-400">{notice}</p>
        ) : null}
        <button type="submit" className={buttonPrimary} disabled={busy}>
          {mode === "signUp" ? t("account.createButton") : t("account.signInButton")}
        </button>
      </form>

      <button
        type="button"
        className={buttonSecondary}
        disabled={busy}
        onClick={() => void run(() => signInWithGoogle(client, accountRedirectUrl()))}
      >
        {t("account.google")}
      </button>

      {mode === "signIn" ? (
        <button
          type="button"
          className="min-h-[44px] self-start underline"
          disabled={busy}
          onClick={() =>
            void run(() => sendPasswordReset(client, email, accountRedirectUrl()), t("account.resetSent"))
          }
        >
          {t("account.forgotPassword")}
        </button>
      ) : null}
    </div>
  );
}
