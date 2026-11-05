import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { chartColor } from "../../lib/chart-colors";

export interface DonutItem {
  /** Identifiant de la catégorie (clé React). */
  key: string;
  name: string;
  /** Montant en unités majeures (pour le graphique). */
  value: number;
  /** Part du total, en pourcentage. */
  share: number;
  count: number;
}

interface CategoryDonutProps {
  items: DonutItem[];
  fmt: (value: number) => string;
}

/**
 * Répartition des dépenses par catégorie : anneau coloré, centre qui affiche le total ou la
 * catégorie choisie, et liste cliquable. Toucher une ligne ou une part la met en évidence.
 */
export function CategoryDonut({ items, fmt }: CategoryDonutProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const current = selected === null ? undefined : items[selected];

  function toggle(index: number) {
    setSelected((prev) => (prev === index ? null : index));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-56 w-56" role="img" aria-label={t("stats.chartAria")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={false}
              onClick={(_data, index) => toggle(index)}
            >
              {items.map((item, i) => (
                <Cell
                  key={item.key}
                  fill={chartColor(i)}
                  fillOpacity={selected === null || selected === i ? 1 : 0.3}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="max-w-full truncate text-sm text-neutral-600 dark:text-muted">
            {current ? current.name : t("stats.donutTotal")}
          </span>
          <span className="text-lg font-semibold tabular-nums text-ink dark:text-fg" data-amount>
            {fmt(current ? current.value : total)}
          </span>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-white/10">
        {items.map((item, i) => (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={selected === i}
              onClick={() => toggle(i)}
              className={`flex min-h-[52px] w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors ${
                selected === i ? "bg-white dark:bg-raised" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: chartColor(i) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink dark:text-fg">{item.name}</span>
                <span className="block text-xs text-neutral-600 dark:text-muted">
                  {t("stats.donutOps", { count: item.count })} · {item.share} %
                </span>
              </span>
              <span className="whitespace-nowrap font-medium tabular-nums text-ink dark:text-fg" data-amount>
                {fmt(item.value)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
