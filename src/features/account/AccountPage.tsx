import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { PageTitle } from "../../components/PageHeader";
import { buttonPrimary, buttonSecondary, Field, inputClass } from "../../components/FormControls";
import { HelpTip } from "../../components/HelpTip";
import { useAccount } from "./AccountProvider";
import {
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
  type AccountErrorCode,
} from "./account-service";

type Mode = "signIn" | "signUp";

/** Page Compte (SPEC §5.14) : connexion, inscription libre, Google, déconnexion. */
export function AccountPage() {
  const { t } = useTranslation();
  const account = useAccount();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountErrorCode | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  if (account.status === "unconfigured") {
    return (
      <section className="flex flex-col gap-4">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <p className="text-neutral-600 dark:text-muted">{t("account.unavailable")}</p>
      </section>
    );
  }

  if (account.status === "loading") {
    return (
      <section className="flex flex-col gap-4">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <p aria-busy="true" className="text-neutral-600 dark:text-muted">{t("account.loading")}</p>
      </section>
    );
  }

  const client = account.client;
  const redirectTo = `${window.location.origin}/plus/account`;

  async function run(action: () => Promise<{ ok: true } | { ok: false; code: AccountErrorCode }>, success?: string) {
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
      void run(
        () => signUpWithEmail(client, email, password, redirectTo),
        t("account.checkEmail"),
      );
    } else {
      void run(() => signInWithEmail(client, email, password));
    }
  }

  if (account.status === "signedIn") {
    return (
      <section className="flex flex-col gap-4">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <p>
          {t("account.signedInAs")} <strong>{account.session.user.email}</strong>
        </p>
        <p className="text-sm text-neutral-600 dark:text-muted">{t("account.localNotice")}</p>
        {error ? (
          <p role="alert" className="text-red-700 dark:text-red-400">{t(`account.errors.${error}`)}</p>
        ) : null}
        <button
          type="button"
          className={buttonSecondary}
          disabled={busy}
          onClick={() => void run(() => signOutAccount(client))}
        >
          {t("account.signOut")}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <PageTitle className="text-2xl font-semibold">{t("account.title")}</PageTitle>
        <HelpTip
          title={t("account.help.title")}
          paragraphs={[t("account.help.p1"), t("account.help.p2")]}
        />
      </div>

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
        onClick={() => void run(() => signInWithGoogle(client, redirectTo))}
      >
        {t("account.google")}
      </button>

      {mode === "signIn" ? (
        <button
          type="button"
          className="min-h-[44px] self-start underline"
          disabled={busy}
          onClick={() =>
            void run(() => sendPasswordReset(client, email, redirectTo), t("account.resetSent"))
          }
        >
          {t("account.forgotPassword")}
        </button>
      ) : null}
    </section>
  );
}
