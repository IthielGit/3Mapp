import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../../components/BottomSheet";
import { buttonPrimary, inputClass } from "../../components/FormControls";
import { onRadioGroupKeyDown } from "../../components/radio-keys";
import type { Category } from "../../db/entities";

interface CategoryPickerProps {
  /** Libellé du champ et titre de la feuille de choix. */
  label: string;
  /** Texte affiché tant qu'aucune catégorie n'est choisie. */
  placeholder: string;
  value: string;
  options: Category[];
  onChange: (id: string) => void;
  /** Ouvre la création d'une catégorie (le formulaire appelant gère la feuille de création). */
  onCreateNew: () => void;
}

/**
 * Choix de catégorie : un champ qui ouvre une feuille avec recherche et « + Nouvelle catégorie » en tête.
 * Remplace la liste déroulante native, où l'option de création était tout en bas de la liste.
 */
export function CategoryPicker({ label, placeholder, value, options, onChange, onCreateNew }: CategoryPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const labelId = useId();
  const valueId = useId();
  const selected = options.find((c) => c.id === value);
  const needle = query.trim().toLocaleLowerCase();
  const shown = needle ? options.filter((c) => c.name.toLocaleLowerCase().includes(needle)) : options;
  // Une seule étape de Tab : le choix coché, sinon le premier affiché.
  const checkedShown = shown.some((c) => c.id === value);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(id: string) {
    onChange(id);
    close();
  }

  function createNew() {
    close();
    onCreateNew();
  }

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => setOpen(true)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span id={valueId} className={selected ? "truncate" : "truncate text-neutral-600 dark:text-muted"}>
          {selected ? `${selected.icon} ${selected.name}` : placeholder}
        </span>
        <span aria-hidden="true" className="text-lg text-neutral-600 dark:text-muted">
          ›
        </span>
      </button>

      <BottomSheet open={open} title={label} onClose={close}>
        <div className="flex flex-col gap-3">
          <button type="button" className={`${buttonPrimary} w-full`} onClick={createNew}>
            + {t("transactions.newCategory")}
          </button>
          <input
            type="search"
            className={inputClass}
            placeholder={t("transactions.search")}
            aria-label={t("transactions.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-600 dark:text-muted">
              {needle ? t("transactions.noSearchResults", { query: query.trim() }) : t("transactions.empty")}
            </p>
          ) : (
            <div role="radiogroup" aria-label={label} onKeyDown={onRadioGroupKeyDown} className="flex flex-col">
              {shown.map((c) => {
                const checked = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked || (!checkedShown && c === shown[0]) ? 0 : -1}
                    onClick={() => pick(c.id)}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-base transition-colors duration-150 ease-out ${
                      checked
                        ? "bg-brand-50 font-semibold text-brand-900 dark:bg-brand-900 dark:text-brand-100"
                        : "text-ink [@media(hover:hover)]:hover:bg-neutral-100 dark:text-fg dark:[@media(hover:hover)]:hover:bg-raised"
                    }`}
                  >
                    <span aria-hidden="true" className="w-6 text-center">
                      {c.icon}
                    </span>
                    <span className="truncate">{c.name}</span>
                    {checked ? (
                      <span aria-hidden="true" className="ml-auto text-brand-700 dark:text-brand-dark">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
