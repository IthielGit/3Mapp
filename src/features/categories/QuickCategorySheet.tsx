import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../../components/BottomSheet";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import { IconPicker } from "../../components/Pickers";
import type { Category } from "../../db/entities";
import { createCategory } from "./category-service";

/** Icône proposée par défaut : la même qu'avant le choix, pour garder un rendu familier. */
const DEFAULT_ICON = "🏷️";

interface QuickCategorySheetProps {
  open: boolean;
  /** Genre de la catégorie : celui de la transaction ou de la récurrence en cours. */
  kind: Category["kind"];
  onClose: () => void;
  /** Appelé avec l'identifiant de la catégorie créée ; le formulaire appelant la sélectionne. */
  onCreated: (id: string) => void;
}

/**
 * Popup de création rapide d'une catégorie. Ouvert depuis « + Nouvelle catégorie » du choix de catégorie :
 * on saisit le nom, on choisit l'icône, la catégorie est créée et sélectionnée sans quitter le formulaire.
 */
export function QuickCategorySheet({ open, kind, onClose, onCreated }: QuickCategorySheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  function close() {
    setName("");
    setIcon(DEFAULT_ICON);
    setError(undefined);
    onClose();
  }

  async function submit() {
    if (trimmed === "" || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const created = await createCategory({
        name: trimmed,
        kind,
        icon,
        color: "#64748b",
        archived: false,
      });
      setName("");
      setIcon(DEFAULT_ICON);
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      title={t("transactions.newCategory")}
      onClose={close}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={buttonSecondary} onClick={close}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={`${buttonPrimary} dark:bg-brand-dark dark:text-ink`}
            disabled={trimmed === "" || saving}
            onClick={() => void submit()}
          >
            {t("common.add")}
          </button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-end gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-raised"
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <Field label={t("common.name")} error={error}>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </Field>
          </div>
        </div>

        <p className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-ink dark:bg-raised dark:text-fg">
          {kind === "income" ? t("categories.income") : t("categories.expense")}
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("common.icon")}</span>
          <IconPicker value={icon} onChange={setIcon} label={t("common.icon")} />
        </div>
      </form>
    </BottomSheet>
  );
}
