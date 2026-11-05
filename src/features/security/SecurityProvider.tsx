import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { buttonSecondary } from "../../components/FormControls";
import { attemptPin } from "./security-service";

interface SecurityValue {
  locked: boolean;
  hideAmounts: boolean;
}

const SecurityContext = createContext<SecurityValue>({ locked: false, hideAmounts: false });

export function useSecurity(): SecurityValue {
  return useContext(SecurityContext);
}

/**
 * Verrouille l'interface si un PIN existe : à l'ouverture, et après le délai d'inactivité
 * configuré quand l'app revient au premier plan (SPEC §5.15).
 * Rappel : le PIN protège l'accès dans l'app ; il ne chiffre pas les données stockées dans le navigateur.
 */
export function SecurityProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const pinSet = Boolean(settings?.pinHash && settings.pinSalt);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // À l'ouverture : verrouillé s'il existe un PIN.
  const initialised = useRef(false);
  useEffect(() => {
    if (settings === undefined || initialised.current) return;
    initialised.current = true;
    setLocked(pinSet);
  }, [settings, pinSet]);

  // Retour au premier plan après le délai configuré.
  useEffect(() => {
    if (!pinSet) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const since = hiddenAt.current;
      hiddenAt.current = null;
      const delay = settings?.autoLockSeconds ?? 0;
      if (since === null) return;
      if (delay === 0 || Date.now() - since >= delay * 1000) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pinSet, settings?.autoLockSeconds]);

  const hideAmounts = Boolean(settings?.hideAmounts);
  useEffect(() => {
    document.documentElement.classList.toggle("hide-amounts", hideAmounts);
  }, [hideAmounts]);

  return (
    <SecurityContext.Provider value={{ locked: locked && pinSet, hideAmounts }}>
      {locked && pinSet ? <PinScreen onUnlock={() => setLocked(false)} /> : children}
    </SecurityContext.Provider>
  );
}

function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [wait, setWait] = useState(0);

  // Compte à rebours de la temporisation.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [wait]);

  async function submit(value: string) {
    if (wait > 0) return;
    const result = await attemptPin(value);
    if (result.ok) {
      onUnlock();
      return;
    }
    setPin("");
    setWait(result.retryInSeconds);
    setMessage(result.reason === "locked" ? t("security.locked") : t("security.wrongPin"));
  }

  function press(key: string) {
    if (key === "⌫") return setPin((p) => p.slice(0, -1));
    const next = pin + key;
    setPin(next);
    if (next.length === 6) void submit(next);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("security.unlock")}
      className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6"
    >
      <h1 className="text-xl font-semibold">{t("security.unlock")}</h1>
      <div aria-label={t("security.digits", { count: pin.length })} className="flex gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border border-neutral-400 ${i < pin.length ? "bg-neutral-900 dark:bg-white" : ""}`}
          />
        ))}
      </div>
      {message ? (
        <p role="alert" className="text-center text-sm text-red-700 dark:text-red-400">
          {message}
          {wait > 0 ? ` ${t("security.retryIn", { seconds: wait })}` : ""}
        </p>
      ) : null}
      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={key}
              type="button"
              disabled={wait > 0}
              onClick={() => press(key)}
              aria-label={key === "⌫" ? t("common.delete") : key}
              className="min-h-[60px] rounded-xl border border-neutral-500 text-2xl font-medium disabled:opacity-50 dark:border-white/15"
            >
              {key}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        className={buttonSecondary}
        disabled={pin.length < 4 || wait > 0}
        onClick={() => void submit(pin)}
      >
        {t("security.confirm")}
      </button>
    </div>
  );
}
