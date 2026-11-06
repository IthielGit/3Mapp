import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buttonSecondary } from "../../components/FormControls";
import { READ_ONLY_BLOCKED_EVENT } from "../../db/sync-tracking";
import { endConsult, type ConsultMarker } from "./consult";
import { installConsultGuard } from "./consult-guard";

const BLOCKED_MESSAGE_MS = 4000;

/**
 * Bannière de consultation : indique le compte consulté (lecture seule) et permet de revenir au sien.
 * Affiche aussi un message quand une tentative de modification est refusée.
 */
export function ConsultBanner({
  client,
  adminId,
  consult,
}: {
  client: SupabaseClient;
  adminId: string;
  consult: ConsultMarker;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Tant que la bannière est affichée, la consultation est en lecture seule à l'écran.
  useEffect(() => installConsultGuard(), []);

  useEffect(() => {
    let timer: number | undefined;
    const onBlocked = () => {
      setBlocked(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBlocked(false), BLOCKED_MESSAGE_MS);
    };
    window.addEventListener(READ_ONLY_BLOCKED_EVENT, onBlocked);
    return () => {
      window.removeEventListener(READ_ONLY_BLOCKED_EVENT, onBlocked);
      window.clearTimeout(timer);
    };
  }, []);

  async function back() {
    setBusy(true);
    try {
      await endConsult(client, adminId);
    } catch {
      // Hors ligne : la consultation est fermée ; la synchro de l'administrateur reprendra au retour du réseau.
    }
    setBusy(false);
    navigate("/plus/admin", { replace: true });
  }

  return (
    <div
      data-consult-allow=""
      role="region"
      aria-label={t("admin.consult.label")}
      className="sticky top-0 z-30 border-b border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-900 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all">
          <span className="font-semibold">{t("admin.consult.banner", { email: consult.email })}</span>
        </p>
        <button
          type="button"
          data-consult-allow=""
          className={`${buttonSecondary} min-h-[44px] px-3`}
          disabled={busy}
          onClick={() => void back()}
        >
          {t("admin.consult.back")}
        </button>
      </div>
      {blocked ? (
        <p role="status" className="mx-auto mt-1 max-w-3xl font-medium">
          {t("admin.consult.blocked")}
        </p>
      ) : null}
    </div>
  );
}
