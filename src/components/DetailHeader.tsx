import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** Action d'un menu : un lien (to) ou une action (onSelect). */
export interface MenuItem {
  label: string;
  to?: string;
  onSelect?: () => void;
  danger?: boolean;
}

const ITEM =
  "flex min-h-[48px] w-full items-center px-4 text-left text-[15px] font-medium active:bg-slate-100 dark:active:bg-raised";

function Dots() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** Bouton « ⋯ » qui ouvre un menu d'actions (fermé par un clic dehors ou par Échap). */
export function ActionMenu({ items }: { items: MenuItem[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("common.more")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
      >
        <Dots />
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 top-12 z-30 min-w-[200px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-card"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              {item.to ? (
                <Link
                  role="menuitem"
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`${ITEM} ${item.danger ? "text-accent" : "text-ink dark:text-fg"}`}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                  className={`${ITEM} ${item.danger ? "text-accent" : "text-ink dark:text-fg"}`}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * En-tête des écrans de détail : retour rond à gauche, titre centré, menu « ⋯ » à droite.
 */
export function DetailHeader({
  title,
  backTo,
  actions,
  children,
}: {
  title: string;
  backTo?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className="flex flex-col gap-1">
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <button
          type="button"
          aria-label={t("common.back")}
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="truncate text-center text-lg font-semibold text-ink dark:text-fg">
          {title}
        </h1>
        <div className="flex justify-end">{actions}</div>
      </div>
      {children}
    </header>
  );
}
