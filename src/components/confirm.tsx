import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";
import { registerConfirmHandler, type ConfirmOptions } from "./confirm-service";

/** Feuille de confirmation unique, montée une fois à la racine de l'application. */
export function ConfirmHost() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ConfirmOptions>({ message: "" });
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(
    () =>
      registerConfirmHandler(
        (options) =>
          new Promise<boolean>((resolve) => {
            // Une nouvelle demande pendant une autre : la précédente est refusée.
            resolver.current?.(false);
            resolver.current = resolve;
            setShown(options);
            setOpen(true);
          }),
      ),
    [],
  );

  function answer(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }

  const danger = shown.danger !== false;
  const label = shown.confirmLabel ?? (danger ? t("common.delete") : t("common.confirm"));

  return (
    <BottomSheet open={open} title={t("common.confirmTitle")} onClose={() => answer(false)}>
      <div className="flex flex-col gap-5">
        <p className="text-base text-ink dark:text-fg">{shown.message}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-[44px] rounded-xl border border-neutral-500 font-medium text-ink dark:border-white/20 dark:text-fg"
            onClick={() => answer(false)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={
              danger
                ? "min-h-[44px] rounded-xl bg-red-700 font-semibold text-white"
                : "min-h-[44px] rounded-xl bg-brand-600 font-semibold text-white dark:bg-brand-dark dark:text-ink"
            }
            onClick={() => answer(true)}
          >
            {label}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
