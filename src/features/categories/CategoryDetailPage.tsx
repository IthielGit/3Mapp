import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { InUseError } from "../../db/errors";
import { ActionMenu, DetailHeader, type MenuItem } from "../../components/DetailHeader";
import { buttonDanger, buttonPrimary } from "../../components/FormControls";
import { deleteCategory, moveCategory, setCategoryArchived } from "./category-service";

const EMPTY: never[] = [];

/** Fiche de consultation d'une catégorie : « Modifier » et « Supprimer » côte à côte en pied de page. */
export function CategoryDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const category = useLiveQuery(() => db.categories.get(id), [id]);
  const subcategories =
    useLiveQuery(() => db.subcategories.where("categoryId").equals(id).toArray(), [id]) ?? EMPTY;
  const [error, setError] = useState<string | undefined>();

  if (category === undefined) return null;
  if (!category) return <p>{t("categories.notFound")}</p>;

  async function archive() {
    await setCategoryArchived(id, true);
    navigate("/plus/categories", { replace: true });
  }

  async function remove() {
    setError(undefined);
    if (!window.confirm(t("categories.deleteConfirm"))) return;
    try {
      await deleteCategory(id);
      navigate("/plus/categories", { replace: true });
    } catch (err) {
      setError(err instanceof InUseError ? t("categories.deleteBlocked") : t("errors.generic"));
    }
  }

  const menu: MenuItem[] = [
    { label: t("common.moveUp"), onSelect: () => void moveCategory(id, -1) },
    { label: t("common.moveDown"), onSelect: () => void moveCategory(id, 1) },
    { label: t("common.archive"), onSelect: () => void archive() },
  ];

  return (
    <section className="flex flex-col gap-4">
      <DetailHeader title={category.name} actions={<ActionMenu items={menu} />} />

      <div className="flex items-center gap-3 rounded-card border border-slate-200 p-4 dark:border-white/15">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl"
          style={{ backgroundColor: category.color }}
        >
          {category.icon}
        </span>
        <span className="text-sm text-slate-600 dark:text-muted">
          {t(`categories.${category.kind}`)}
        </span>
      </div>

      {subcategories.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("categories.subcategories")}</h2>
          <ul className="flex flex-col divide-y divide-slate-200 rounded-card border border-slate-200 dark:divide-white/10 dark:border-white/15">
            {subcategories.map((sub) => (
              <li key={sub.id} className="flex items-center gap-3 p-3">
                <span aria-hidden="true" className="text-xl">
                  {sub.icon}
                </span>
                <span>{sub.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/plus/categories/${id}/edit`} className={`${buttonPrimary} inline-flex items-center justify-center`}>
          {t("common.edit")}
        </Link>
        <button type="button" className={buttonDanger} onClick={() => void remove()}>
          {t("common.delete")}
        </button>
      </div>
    </section>
  );
}
