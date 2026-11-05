import { useTranslation } from "react-i18next";
import { Icon } from "../../components/Icon";
import { useSyncStatus } from "./useSyncStatus";

/**
 * Bouton de synchro manuelle (accueil). La synchro reste automatique ; ce bouton permet de la relancer.
 * Affiché seulement quand un compte est connecté. Point coloré : modifications en attente (brand) ou erreur (rouge).
 */
export function SyncButton() {
  const { t } = useTranslation();
  const status = useSyncStatus();
  if (!status.signedIn) return null;

  const label = status.busy
    ? t("account.sync.buttonBusy")
    : status.error
      ? t("account.sync.buttonError")
      : status.pending > 0
        ? t("account.sync.buttonPending", { count: status.pending })
        : t("account.sync.button");

  return (
    <button
      type="button"
      onClick={() => void status.syncNow()}
      aria-label={label}
      title={label}
      disabled={status.busy}
      className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm disabled:opacity-70 dark:bg-raised dark:text-fg"
    >
      <Icon name="sync" className={`h-5 w-5 ${status.busy ? "animate-spin motion-reduce:animate-none" : ""}`} />
      {status.error || status.pending > 0 ? (
        <span
          aria-hidden="true"
          className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-raised ${
            status.error ? "bg-red-600" : "bg-brand-600"
          }`}
        />
      ) : null}
    </button>
  );
}
