import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../../components/BottomSheet";
import { Field, buttonPrimary, buttonSecondary, inputClass } from "../../components/FormControls";
import type { Category } from "../../db/entities";
import { createCategory } from "./category-service";

interface QuickCategorySheetProps {
  open: boolean;
  /** Genre de la catégorie : celui de la transaction ou de la récurrence en cours. */
  kind: Category["kind"];
  onClose: () => void;
  /** Appelé avec l'identifiant de la catégorie créée ; le formulaire appelant la sélectionne. */
  onCreated: (id: string) => void;
}

/**
 * Popup de création rapide d'une catégorie. Ouvert depuis le choix « Nouvelle catégorie » de la
 * liste déroulante : on saisit le nom, la catégorie est créée et sélectionnée, sans quitter le formulaire.
 */
export function QuickCategorySheet({ open, kind, onClose, onCreated }: QuickCategorySheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  function close() {
    setName("");
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
        icon: "🏷️",
        color: "#64748b",
        archived: false,
      });
      setName("");
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
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={buttonSecondary} onClick={close}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={buttonPrimary}
            disabled={trimmed === "" || saving}
            onClick={() => void submit()}
          >
            {t("common.add")}
          </button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t("common.name")} error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <p className="text-sm text-slate-600 dark:text-muted">
          {kind === "income" ? t("categories.income") : t("categories.expense")}
        </p>
      </form>
    </BottomSheet>
  );
}
