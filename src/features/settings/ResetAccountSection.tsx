import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../../components/BottomSheet";
import { Icon } from "../../components/Icon";
import { buttonSecondary, inputClass } from "../../components/FormControls";
import { db } from "../../db/database";
import { resetAccount } from "./reset-account";

/**
 * Ligne « Réinitialiser le compte » : un toucher révèle l'avertissement et le gros bouton rouge.
 * Le bouton rouge ouvre une confirmation avant toute suppression.
 */
export function ResetAccountSection() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [typed, setTyped] = useState("");
  const word = t("resetAccount.typeWord");
  const typedOk = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  async function confirm() {
    if (!typedOk) return;
    setBusy(true);
    setError(undefined);
    try {
      await resetAccount(db);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
      setBusy(false);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 font-medium text-expense dark:text-red-300 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-raised"
          >
            <Icon name="reset" className="h-4 w-4" />
          </span>
          {t("resetAccount.button")}
        </span>
        <span
          aria-hidden="true"
          className={`text-xl text-neutral-600 transition-transform duration-200 ease-out-strong motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-sm text-neutral-600 dark:text-muted">{t("resetAccount.warning")}</p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-[56px] w-full rounded-2xl bg-expense px-4 text-base font-semibold text-white active:scale-[0.98]"
          >
            {t("resetAccount.confirm")}
          </button>
        </div>
      ) : null}

      <BottomSheet
        open={sheetOpen}
        title={t("resetAccount.title")}
        onClose={() => {
          if (!busy) setSheetOpen(false);
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">{t("resetAccount.warning")}</p>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t("resetAccount.typeLabel", { word })}</span>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              className={inputClass}
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => setSheetOpen(false)}
              disabled={busy}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-lg bg-expense px-4 font-semibold text-white disabled:opacity-50"
              onClick={() => void confirm()}
              disabled={busy || !typedOk}
            >
              {t("resetAccount.confirm")}
            </button>
          </div>
        </div>
      </BottomSheet>
    </li>
  );
}
