import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { Field, inputClass } from "../../components/FormControls";
import { categoryChoices } from "../../domain/category-options";

interface LinkedCategoryFieldProps {
  /** Nature de la transaction créée dans le portefeuille lié : dépense ou revenu. */
  kind: "expense" | "income";
  value: string;
  onChange: (categoryId: string) => void;
}

/**
 * Catégorie de la transaction créée quand un portefeuille est lié (versement, dette, remboursement).
 * Affiché uniquement avec un portefeuille lié : sans lui, aucune transaction n'est créée.
 */
export function LinkedCategoryField({ kind, value, onChange }: LinkedCategoryFieldProps) {
  const { t } = useTranslation();
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const options = categoryChoices(categories, kind, value || undefined);
  return (
    <Field label={t("common.category")}>
      <select
        className={inputClass}
        value={value}
        required
        aria-required="true"
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("transactions.chooseCategory")}</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
