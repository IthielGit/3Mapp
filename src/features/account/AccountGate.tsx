import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { buttonSecondary } from "../../components/FormControls";
import { SyncBootstrap } from "../sync/SyncBootstrap";
import { AuthForm } from "./AuthForm";
import { useAccount } from "./AccountProvider";
import { signOutAndClear } from "./sign-out";

/**
 * Porte d'entrée de l'application : un compte est obligatoire (décision du propriétaire).
 * - Pas de compte : seul l'écran de connexion s'affiche.
 * - Compte suspendu : écran de blocage (SPEC §5.14), l'accès local est coupé aussi.
 * - Compte actif : la synchronisation démarre et l'app s'ouvre après la première fusion.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const account = useAccount();
  const [busy, setBusy] = useState(false);

  if (account.status === "loading") {
    return (
      <div aria-busy="true" className="min-h-screen" role="status">
        <span className="sr-only">{t("account.loading")}</span>
      </div>
    );
  }

  if (account.status === "unconfigured") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("account.title")}</h1>
        <p className="text-neutral-700 dark:text-muted">{t("account.gate.unconfigured")}</p>
      </main>
    );
  }

  if (account.status === "signedOut") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("account.gate.title")}</h1>
          <p className="text-neutral-700 dark:text-muted">{t("account.gate.intro")}</p>
        </div>
        <AuthForm client={account.client} />
      </main>
    );
  }

  if (account.status === "suspended") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t("account.suspended.title")}</h1>
        <p className="text-neutral-700 dark:text-muted">{t("account.suspended.body")}</p>
        <button
          type="button"
          className={buttonSecondary}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signOutAndClear(account.client).finally(() => setBusy(false));
          }}
        >
          {t("account.signOut")}
        </button>
      </main>
    );
  }

  return <SyncBootstrap>{children}</SyncBootstrap>;
}
