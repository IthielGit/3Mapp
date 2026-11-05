import { PageTitle } from "../../components/PageHeader";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { db } from "../../db/database";
import { RuleError } from "../../db/errors";
import {
  Field,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "../../components/FormControls";
import { removePin, setAutoLock, setBiometric, setHideAmounts, setPin } from "./security-service";

const AUTO_LOCK_OPTIONS = [0, 30, 60, 300, -1] as const;

export function SecurityPage() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const pinExists = settings?.pinHash !== undefined && settings?.pinHash !== "";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  if (settings === undefined) return null;
  const biometricSupported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  async function run(action: () => Promise<void>, ok: string) {
    setError(undefined);
    setMessage(undefined);
    try {
      await action();
      setMessage(ok);
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(err instanceof RuleError ? err.message : t("errors.generic"));
    }
  }

  async function enableBiometric() {
    await run(async () => {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Fundora", id: window.location.hostname },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "budget",
            displayName: "Fundora",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { userVerification: "required" },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new RuleError(t("security.biometricFailed"));
      await setBiometric(btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
    }, t("security.biometricOn"));
  }

  return (
    <section className="flex flex-col gap-6">
      <PageTitle className="text-2xl font-semibold">{t("security.title")}</PageTitle>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("security.pinTitle")}</h2>
        {pinExists ? (
          <Field label={t("security.currentPin")}>
            <input
              type="password"
              inputMode="numeric"
              className={inputClass}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
        ) : null}
        <Field label={pinExists ? t("security.newPin") : t("security.createPin")}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            className={inputClass}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className={buttonPrimary}
          onClick={() =>
            void run(() => setPin(next, pinExists ? current : undefined), t("security.saved"))
          }
        >
          {pinExists ? t("security.change") : t("security.create")}
        </button>
        {pinExists ? (
          <button
            type="button"
            className={buttonDanger}
            onClick={() => void run(() => removePin(current), t("security.removed"))}
          >
            {t("security.remove")}
          </button>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("security.autoLockTitle")}</h2>
        <Field label={t("security.autoLock")}>
          <select
            className={inputClass}
            value={settings.autoLockSeconds ?? 0}
            onChange={(e) =>
              void run(
                () => setAutoLock(Number(e.target.value) < 0 ? 0 : Number(e.target.value)),
                t("security.saved"),
              )
            }
          >
            {AUTO_LOCK_OPTIONS.map((s) => (
              <option key={s} value={s < 0 ? 0 : s}>
                {s === 0
                  ? t("security.lockImmediately")
                  : s < 0
                    ? t("security.never")
                    : t("security.afterSeconds", { seconds: s })}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <label className="flex min-h-[44px] items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={Boolean(settings.hideAmounts)}
          onChange={(e) => void run(() => setHideAmounts(e.target.checked), t("security.saved"))}
        />
        {t("security.hideAmounts")}
      </label>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("security.biometricTitle")}</h2>
        {settings.biometricCredentialId ? (
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => void run(() => setBiometric(undefined), t("security.biometricOff"))}
          >
            {t("security.biometricDisable")}
          </button>
        ) : biometricSupported ? (
          <button type="button" className={buttonSecondary} onClick={() => void enableBiometric()}>
            {t("security.biometricEnable")}
          </button>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-muted">{t("security.biometricUnsupported")}</p>
        )}
      </section>

      {message ? (
        <p role="status" className="text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
