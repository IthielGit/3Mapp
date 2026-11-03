import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../lib/theme-context";

export function MorePage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("pages.more.title")}</h1>

      <nav aria-label={t("pages.more.title")} className="flex flex-col gap-2">
        <Link
          to="/plus/wallets"
          className="flex min-h-[44px] items-center rounded-lg border border-slate-200 px-4 font-medium dark:border-slate-700"
        >
          {t("more.wallets")}
        </Link>
        <Link
          to="/plus/categories"
          className="flex min-h-[44px] items-center rounded-lg border border-slate-200 px-4 font-medium dark:border-slate-700"
        >
          {t("more.categories")}
        </Link>
      </nav>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("pages.more.theme")}</legend>
        {(["light", "dark"] as const).map((mode) => (
          <label
            key={mode}
            className="flex min-h-[44px] items-center gap-3 rounded-lg border border-slate-200 px-4 dark:border-slate-700"
          >
            <input
              type="radio"
              name="theme"
              value={mode}
              checked={theme === mode}
              onChange={() => setTheme(mode)}
              className="h-5 w-5"
            />
            {t(mode === "light" ? "pages.more.themeLight" : "pages.more.themeDark")}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
