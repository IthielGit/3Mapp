import type { ReactNode } from "react";

export const inputClass =
  "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-white/15 dark:bg-card";

export const buttonPrimary =
  "min-h-[44px] rounded-lg bg-brand-700 px-4 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-ink";

export const buttonSecondary =
  "min-h-[44px] rounded-lg border border-slate-300 px-4 font-medium dark:border-white/15";

export const buttonDanger =
  "min-h-[44px] rounded-lg border border-red-300 px-4 font-medium text-red-700 dark:border-red-800 dark:text-red-400";

interface FieldProps {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}
