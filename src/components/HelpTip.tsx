import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";

interface HelpTipProps {
  /** Titre de la feuille d'aide (déjà traduit). */
  title: string;
  /** Paragraphes d'explication (déjà traduits). */
  paragraphs?: string[];
  /** Étapes numérotées, pour un petit didacticiel (déjà traduites). */
  steps?: string[];
}

/**
 * Bouton « ? » qui ouvre une courte explication ou un petit guide pas à pas dans une feuille.
 * Les textes sont passés déjà traduits par l'écran appelant.
 */
export function HelpTip({ title, paragraphs = [], steps = [] }: HelpTipProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`${t("help.open")} : ${title}`}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-500 text-base font-semibold text-ink dark:border-white/15 dark:text-fg"
      >
        ?
      </button>
      <BottomSheet open={open} title={title} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3 text-sm text-ink dark:text-fg">
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {steps.length > 0 ? (
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
