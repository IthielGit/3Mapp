import { useState } from "react";
import { useTranslation } from "react-i18next";
import { askConfirm } from "../../components/confirm-service";
import { useSyncStatus } from "../sync/useSyncStatus";
import { useAccount } from "./AccountProvider";
import { signOutAndClear } from "./sign-out";

/**
 * Déconnexion avec confirmation (page Compte et menu du compte).
 * L'avertissement annonce les modifications non envoyées, qui seront perdues.
 */
export function useSignOut(): { busy: boolean; signOut: () => Promise<void> } {
  const { t } = useTranslation();
  const account = useAccount();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (account.status !== "signedIn") return;
    const client = account.client;
    const lost = sync.pending;
    const confirmed = await askConfirm({
      message:
        t("account.signOutConfirm") + (lost > 0 ? " " + t("account.signOutLost", { count: lost }) : ""),
      confirmLabel: t("account.signOut"),
    });
    if (!confirmed) return;
    setBusy(true);
    await signOutAndClear(client);
    setBusy(false);
  }

  return { busy, signOut };
}
