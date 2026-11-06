import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount } from "../features/account/AccountProvider";
import { useAccountIdentity } from "../features/account/account-identity";
import { useSignOut } from "../features/account/use-sign-out";
import { useTheme, type ThemeMode } from "../lib/theme-context";
import { Icon, type IconName } from "./Icon";

/** Engrenage des réglages (tracé ISC, Lucide). */
export function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const ITEM =
  "flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm font-medium text-ink active:bg-neutral-100 dark:text-fg dark:active:bg-raised";

const ICON = "h-4 w-4 shrink-0 text-neutral-600 dark:text-muted";

/** Choix de thème du menu : Système, Clair, Sombre (libellés et icônes). */
const THEME_OPTIONS: {
  mode: ThemeMode;
  icon: IconName;
  label: "pages.more.themeSystem" | "pages.more.themeLight" | "pages.more.themeDark";
}[] = [
  { mode: "system", icon: "monitor", label: "pages.more.themeSystem" },
  { mode: "light", icon: "sun", label: "pages.more.themeLight" },
  { mode: "dark", icon: "moon", label: "pages.more.themeDark" },
];

/**
 * Avatar du compte, en haut à droite de chaque écran : ouvre un petit menu
 * (Mon compte, Paramètres, thème, Se déconnecter). Sans session chargée, il se réduit à l'engrenage vers Paramètres.
 */
export function AccountMenu() {
  const { t } = useTranslation();
  const account = useAccount();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Le menu se referme à chaque changement d'écran (comparaison pendant le rendu, sans effet).
  const [seenPath, setSeenPath] = useState(location.pathname);
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    setOpen(false);
  }
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const { busy, signOut } = useSignOut();
  const { theme, setTheme } = useTheme();
  const identity = useAccountIdentity();
  // Photo du compte (Google) : si elle ne charge pas, on revient à l'initiale.
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Fermeture au clic dehors et à Échap (Échap rend le focus au bouton).
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // À l'ouverture, le focus va sur la première entrée (accessibilité clavier).
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (account.status !== "signedIn") {
    return (
      <Link
        to="/plus"
        aria-label={t("nav.more")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm dark:bg-raised dark:text-fg"
      >
        <GearIcon />
      </Link>
    );
  }

  const email = account.session.user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  // Flèches haut/bas entre les entrées (y compris les choix de thème), sans sortir du menu.
  function onMenuKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]') ?? [],
    );
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = (index + step + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
      // Tab qui quitte le menu (vers la suite de la page) le referme : le focus reste où Tab l'a porté.
      onBlur={(event) => {
        if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("accountMenu.open")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-base font-semibold text-brand-700 shadow-sm dark:bg-raised dark:text-brand-dark"
      >
        {identity.avatarUrl && !avatarFailed ? (
          <img
            src={identity.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>
      {open ? (
        <ul
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKey}
          className="menu-pop absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-card"
        >
          <li role="none" className="truncate px-4 pb-1 pt-2 text-xs text-neutral-600 dark:text-muted" title={email}>
            {email}
          </li>
          <li role="none">
            <Link role="menuitem" to="/plus" className={ITEM} onClick={() => setOpen(false)}>
              <Icon name="sliders" className={ICON} />
              {t("nav.more")}
            </Link>
          </li>
          <li role="none">
            <Link role="menuitem" to="/plus/account" className={ITEM} onClick={() => setOpen(false)}>
              <Icon name="user" className={ICON} />
              {t("account.title")}
            </Link>
          </li>
          {/* Thème : une seule ligne, trois icônes en bloc (libellés accessibles et infobulles). */}
          <li role="none" className="mt-1 flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-2 dark:border-white/10">
            <span className="text-sm font-medium text-ink dark:text-fg">{t("pages.more.theme")}</span>
            <div role="group" aria-label={t("pages.more.theme")} className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5 dark:bg-raised">
              {THEME_OPTIONS.map((option) => {
                const checked = theme === option.mode;
                return (
                  <button
                    key={option.mode}
                    role="menuitemradio"
                    type="button"
                    aria-checked={checked}
                    aria-label={t(option.label)}
                    title={t(option.label)}
                    onClick={() => setTheme(option.mode)}
                    className={`flex h-8 w-9 items-center justify-center rounded-md ${
                      checked
                        ? "bg-white text-brand-700 shadow-sm dark:bg-card dark:text-brand-dark"
                        : "text-neutral-600 dark:text-muted"
                    }`}
                  >
                    <Icon name={option.icon} className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </li>
          <li role="none" className="border-t border-neutral-200 dark:border-white/10">
            <button
              role="menuitem"
              type="button"
              disabled={busy}
              className={`${ITEM} disabled:opacity-50`}
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <Icon name="logout" className={ICON} />
              {t("account.signOut")}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
