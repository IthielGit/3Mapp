import { PageTitle } from "../../components/PageHeader";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { InUseError, RuleError } from "../../db/errors";
import type { Category, Subcategory } from "../../db/entities";
import { ColorPicker, IconPicker } from "../../components/Pickers";
import {
  Field,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "../../components/FormControls";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  mergeCategories,
  updateCategory,
} from "./category-service";

export function CategoryFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [existing, setExisting] = useState<Category | undefined>();
  const [loaded, setLoaded] = useState(!id);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<Category["kind"]>(
    params.get("kind") === "income" ? "income" : "expense",
  );
  const [icon, setIcon] = useState("📦");
  const [color, setColor] = useState("#0f766e");
  const [subName, setSubName] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (!id) return;
    void db.categories.get(id).then((category) => {
      if (!category) return;
      setExisting(category);
      setName(category.name);
      setKind(category.kind);
      setIcon(category.icon);
      setColor(category.color);
      setLoaded(true);
    });
  }, [id]);

  const subcategories = useLiveQuery(
    () =>
      id
        ? db.subcategories.where("categoryId").equals(id).toArray()
        : Promise.resolve<Subcategory[]>([]),
    [id],
  );
  const sameKindCategories = useLiveQuery(
    () => db.categories.filter((c) => c.kind === kind && c.id !== id && !c.archived).toArray(),
    [kind, id],
  );

  if (!loaded) return null;

  async function save() {
    setError(undefined);
    if (name.trim() === "") return setNameError(t("errors.required"));
    if (existing) {
      await updateCategory(existing.id, { name: name.trim(), icon, color });
      navigate("/plus/categories");
    } else {
      await createCategory({ name: name.trim(), kind, icon, color, archived: false });
      navigate("/plus/categories");
    }
  }

  async function remove() {
    if (!existing) return;
    setError(undefined);
    if (!window.confirm(t("categories.deleteConfirm"))) return;
    try {
      await deleteCategory(existing.id);
      navigate("/plus/categories", { replace: true });
    } catch (err) {
      setError(err instanceof InUseError ? t("categories.deleteBlocked") : t("errors.generic"));
    }
  }

  async function merge() {
    if (!existing || !mergeTarget) return;
    setError(undefined);
    if (!window.confirm(t("categories.mergeConfirm"))) return;
    try {
      await mergeCategories(existing.id, mergeTarget);
      navigate("/plus/categories", { replace: true });
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  async function addSub() {
    if (!existing || subName.trim() === "") return;
    await createSubcategory(existing.id, subName.trim(), icon);
    setSubName("");
  }

  return (
    <section className="flex flex-col gap-4">
      <PageTitle className="text-2xl font-semibold">
        {existing ? t("categories.editTitle") : t("categories.newTitle")}
      </PageTitle>

      <Field label={t("common.name")} error={nameError}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
          }}
        />
      </Field>

      <Field label={t("categories.kind")}>
        <select
          className={inputClass}
          value={kind}
          disabled={existing !== undefined}
          onChange={(e) => setKind(e.target.value as Category["kind"])}
        >
          <option value="expense">{t("categories.expense")}</option>
          <option value="income">{t("categories.income")}</option>
        </select>
      </Field>

      <IconPicker value={icon} onChange={setIcon} label={t("common.icon")} />
      <ColorPicker value={color} onChange={setColor} label={t("common.color")} />

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button type="button" className={buttonSecondary} onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </button>
        <button type="button" className={buttonPrimary} onClick={save}>
          {t("common.save")}
        </button>
      </div>

      {existing ? (
        <>
          <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/15">
            <h2 className="font-semibold">{t("categories.subcategories")}</h2>
            <ul className="flex flex-col gap-2">
              {(subcategories ?? []).map((sub) => (
                <li key={sub.id} className="flex items-center justify-between gap-2">
                  <span>{sub.name}</span>
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={async () => {
                      try {
                        await deleteSubcategory(sub.id);
                      } catch (err) {
                        setError(
                          err instanceof InUseError
                            ? t("categories.subDeleteBlocked")
                            : t("errors.generic"),
                        );
                      }
                    }}
                  >
                    {t("common.delete")}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={subName}
                placeholder={t("categories.subPlaceholder")}
                onChange={(e) => setSubName(e.target.value)}
              />
              <button type="button" className={buttonSecondary} onClick={addSub}>
                {t("common.add")}
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/15">
            <h2 className="font-semibold">{t("categories.merge")}</h2>
            <p className="text-sm text-slate-600 dark:text-muted">{t("categories.mergeHint")}</p>
            <select
              className={inputClass}
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
            >
              <option value="">{t("categories.mergeTarget")}</option>
              {(sameKindCategories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={buttonSecondary}
              disabled={!mergeTarget}
              onClick={merge}
            >
              {t("categories.merge")}
            </button>
          </section>

          <button type="button" className={buttonDanger} onClick={remove}>
            {t("common.delete")}
          </button>
        </>
      ) : null}
    </section>
  );
}
