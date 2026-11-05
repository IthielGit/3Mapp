import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import type { Category } from "../../db/entities";
import { buttonPrimary, buttonSecondary } from "../../components/FormControls";
import { moveCategory, setCategoryArchived } from "./category-service";

type Kind = Category["kind"];

export function CategoriesPage() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Kind>("expense");
  const categories = useLiveQuery(() => db.categories.orderBy("sortOrder").toArray(), []);
  if (!categories) return null;

  const ofKind = categories.filter((c) => c.kind === kind);
  const active = ofKind.filter((c) => !c.archived);
  const archived = ofKind.filter((c) => c.archived);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <PageTitle className="text-2xl font-semibold">{t("categories.title")}</PageTitle>
        <Link
          to={`/plus/categories/new?kind=${kind}`}
          className={buttonPrimary + " inline-flex items-center"}
        >
          {t("common.add")}
        </Link>
      </header>

      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-[44px] rounded-lg border font-medium ${
              kind === k
                ? "border-brand-700 bg-brand-50 text-brand-700 dark:bg-raised"
                : "border-slate-300 dark:border-white/15"
            }`}
          >
            {t(`categories.${k}`)}
          </button>
        ))}
      </div>

      {active.length === 0 ? <p className="text-slate-600">{t("categories.empty")}</p> : null}

      <ul className="flex flex-col gap-2">
        {active.map((category, index) => (
          <li
            key={category.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/15"
          >
            <Link
              to={`/plus/categories/${category.id}/edit`}
              className="flex flex-1 items-center gap-3"
            >
              <span aria-hidden="true" className="text-2xl">
                {category.icon}
              </span>
              <span className="font-medium">{category.name}</span>
            </Link>
            <button
              type="button"
              className={buttonSecondary}
              aria-label={t("common.moveUp")}
              disabled={index === 0}
              onClick={() => moveCategory(category.id, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={buttonSecondary}
              aria-label={t("common.moveDown")}
              disabled={index === active.length - 1}
              onClick={() => moveCategory(category.id, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => setCategoryArchived(category.id, true)}
            >
              {t("common.archive")}
            </button>
          </li>
        ))}
      </ul>

      {archived.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-600">{t("categories.archivedSection")}</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/15"
              >
                <span>
                  {category.icon} {category.name}
                </span>
                <button
                  type="button"
                  className={buttonSecondary}
                  onClick={() => setCategoryArchived(category.id, false)}
                >
                  {t("common.restore")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
