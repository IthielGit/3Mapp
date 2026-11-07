import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { announce } from "../../components/announce";
import {
  INITIAL_ANNOUNCE_MEMORY,
  nextSyncAnnouncement,
  syncStatusLine,
  type SyncAgo,
  type SyncStatusLine as Line,
} from "../../domain/sync-status";
import { useOnline } from "./useOnline";
import { useSyncStatus } from "./useSyncStatus";

/** L'ancienneté (« il y a 2 min ») est recalculée chaque minute, seulement quand l'app est visible. */
const TICK_MS = 60_000;

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    const timer = window.setInterval(refresh, TICK_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return now;
}

function agoText(t: TFunction, ago: SyncAgo): string {
  if (ago.unit === "now") return t("home.status.agoNow");
  return t(`home.status.ago.${ago.unit}`, { count: ago.value });
}

function lineText(t: TFunction, line: Line): string {
  switch (line.kind) {
    case "hidden":
      return "";
    case "offline":
      return line.pending > 0
        ? t("home.status.offlinePending", { count: line.pending })
        : t("home.status.offlineSaved");
    case "syncing":
      return t("home.status.syncing");
    case "error": {
      const message = t(`home.status.error.${line.code}`);
      return line.pending > 0 ? t("home.status.withPending", { message, count: line.pending }) : message;
    }
    case "pending":
      return t("home.status.pending", { count: line.pending });
    case "upToDate":
      return line.ago ? t("home.status.upToDateAgo", { ago: agoText(t, line.ago) }) : t("home.status.upToDate");
  }
}

/**
 * Ligne d'état sous l'en-tête de l'accueil : hors ligne, envois en attente, synchro, erreur ou « à jour ».
 * Texte lisible (pas seulement une couleur) ; rouge réservé aux erreurs. Les changements importants
 * (hors ligne, retour du réseau, nouvelle erreur) sont annoncés aux lecteurs d'écran.
 */
/** Témoin de l'état, version discrète : vert à jour, bleu en synchro, orange en attente, rouge en erreur. */
function inlineDotClass(kind: Line["kind"]): string {
  switch (kind) {
    case "error":
      return "bg-expense dark:bg-expense-dark";
    case "offline":
    case "pending":
      return "bg-amber-500";
    case "syncing":
      return "bg-brand-600 dark:bg-brand-dark";
    default:
      return "bg-income dark:bg-income-dark";
  }
}

/**
 * `inline` : version discrète pour l'en-tête, à gauche du bouton de synchro. Pas de point dans l'état
 * calme (le texte suffit) ; le point reste sur les états hors ligne et erreur, avec le texte en plus.
 */
export function SyncStatusLine({ inline = false }: { inline?: boolean } = {}) {
  const { t } = useTranslation();
  const status = useSyncStatus();
  const online = useOnline();
  const now = useMinuteClock();
  const line = syncStatusLine({
    signedIn: status.signedIn,
    online,
    busy: status.busy,
    pending: status.pending,
    error: status.error,
    lastSyncAt: status.state?.lastSyncAt,
    now,
  });

  const memory = useRef(INITIAL_ANNOUNCE_MEMORY);
  const errorCode = line.kind === "error" ? line.code : undefined;
  useEffect(() => {
    const next = nextSyncAnnouncement(memory.current, line);
    memory.current = next.memory;
    if (next.announce === "offline") announce(t("home.status.announce.offline"));
    else if (next.announce === "restored") announce(t("home.status.announce.restored"));
    else if (next.announce === "error" && errorCode)
      announce(`${t("a11y.syncFailed")} ${t(`account.sync.error.${errorCode}`)}`, "assertive");
    // Seuls le type d'état et le code d'erreur comptent : l'horloge et le nombre d'envois ne déclenchent rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.kind, errorCode]);

  if (line.kind === "hidden") return null;
  const isError = line.kind === "error";

  return (
    <div
      className={
        inline
          ? "flex min-w-0 items-center justify-end gap-1.5 text-right text-[11px]"
          : "flex min-h-5 items-center gap-2 text-xs font-medium"
      }
    >
      {inline ? (
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${inlineDotClass(line.kind)}`} />
      ) : (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isError
              ? "bg-expense dark:bg-expense-dark"
              : line.kind === "offline" || line.kind === "pending"
                ? "bg-neutral-500 dark:bg-muted"
                : "bg-brand-500"
          }`}
        />
      )}
      <p
        className={
          isError
            ? "text-expense dark:text-expense-dark"
            : inline
              ? "text-neutral-600 opacity-85 dark:text-muted"
              : "text-neutral-600 dark:text-muted"
        }
        data-testid="sync-status"
      >
        {lineText(t, line)}
      </p>
      {isError && (line.code === "network" || line.code === "unknown") ? (
        <button
          type="button"
          onClick={() => void status.syncNow()}
          className="-my-3 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-brand-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-dark"
        >
          {t("home.status.retry")}
        </button>
      ) : null}
    </div>
  );
}
