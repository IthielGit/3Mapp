import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { buttonSecondary } from "../../components/FormControls";
import { useAccount } from "./AccountProvider";
import { signOutAccount } from "./account-service";

/**
 * Bloque l'application quand le compte est suspendu (SPEC §5.14, décision du propriétaire) :
 * l'accès local est coupé aussi, pas seulement la synchronisation.
 * Le temps de lecture du profil, on attend au lieu d'afficher l'app avant de savoir.
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

  if (account.status !== "suspended") return <>{children}</>;

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
          void signOutAccount(account.client).finally(() => setBusy(false));
        }}
      >
        {t("account.signOut")}
      </button>
    </main>
  );
}
