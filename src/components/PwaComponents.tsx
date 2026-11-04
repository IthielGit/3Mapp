import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { buttonPrimary } from "./FormControls";
import { installUpdate, promptInstall, useInstallState, useUpdateAvailable } from "../lib/pwa";

/** Bandeau affiché quand une nouvelle version de l'application est prête. */
export function UpdateBanner() {
  const { t } = useTranslation();
  const available = useUpdateAvailable();
  const [busy, setBusy] = useState(false);
  if (!available) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg bg-slate-900 p-3 text-sm text-white shadow-lg"
    >
      <span>{t("pwa.updateAvailable")}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void installUpdate();
        }}
        className="min-h-[44px] rounded-lg bg-white px-3 font-semibold text-ink"
      >
        {t("pwa.update")}
      </button>
    </div>
  );
}

/** Carte « Installer l'application » : invite native, ou marche à suivre sur iPhone/iPad. */
export function InstallCard() {
  const { t } = useTranslation();
  const state = useInstallState();
  const [message, setMessage] = useState<string | undefined>();

  if (state === "installed" || state === "unavailable") return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 className="font-semibold">{t("pwa.installTitle")}</h2>
      {state === "available" ? (
        <>
          <p className="text-sm text-slate-500">{t("pwa.installHint")}</p>
          <button
            type="button"
            className={buttonPrimary}
            onClick={() =>
              void promptInstall().then((accepted) =>
                setMessage(accepted ? t("pwa.installDone") : undefined),
              )
            }
          >
            {t("pwa.installButton")}
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-500">{t("pwa.installIosHint")}</p>
      )}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}

/** Squelette de chargement : affiché à la place du contenu le temps que la base réponde. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200 dark:bg-raised ${className}`}
    />
  );
}

/** État vide illustré : une icône, un message et, si besoin, une action. */
export function EmptyState({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
      <span aria-hidden="true" className="text-4xl">
        {icon}
      </span>
      <p className="text-slate-600 dark:text-muted">{title}</p>
      {action}
    </div>
  );
}
