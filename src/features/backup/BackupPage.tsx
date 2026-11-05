import { PageTitle } from "../../components/PageHeader";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { db } from "../../db/database";
import { buttonPrimary, buttonSecondary, Field, inputClass } from "../../components/FormControls";
import { downloadBlob } from "../../lib/download";
import { canShareFiles, shareFile } from "../../lib/share";
import { MIN_PASSWORD_LENGTH } from "./backup-format";
import {
  backupFileName,
  createBackup,
  isEncryptedBackup,
  markBackupDone,
  prepareRestore,
  readBackupText,
  restoreBackup,
  serializeBackup,
  type PreparedRestore,
  type RestoreMode,
} from "./backup-service";
import { backupReminder } from "../../domain/backup";

const DATE_FORMAT = "dd/MM/yyyy HH:mm";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Sauvegarde déjà chiffrée (ou non) et prête à être partagée. */
interface ReadyShare {
  blob: Blob;
  name: string;
}

export function BackupPage() {
  const { t } = useTranslation();
  const state = useLiveQuery(
    async () => ({
      settings: await db.settings.toCollection().first(),
      transactions: await db.transactions.count(),
    }),
    [],
  );

  const [persisted, setPersisted] = useState<boolean | undefined>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [readyShare, setReadyShare] = useState<ReadyShare | undefined>();

  const [encryptedText, setEncryptedText] = useState<string | undefined>();
  const [decryptPassword, setDecryptPassword] = useState("");
  const [prepared, setPrepared] = useState<PreparedRestore | undefined>();
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [confirmed, setConfirmed] = useState(false);
  const [restored, setRestored] = useState<number | undefined>();

  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(undefined));
  }, []);

  const settings = state?.settings;
  const lastBackupAt = settings?.lastBackupAt;
  const reminder = backupReminder(lastBackupAt, new Date(), (state?.transactions ?? 0) > 0);

  function resetImport() {
    setEncryptedText(undefined);
    setDecryptPassword("");
    setPrepared(undefined);
    setConfirmed(false);
    setRestored(undefined);
  }

  /** Enregistre le fichier de sauvegarde sur l'appareil. */
  async function onDownload() {
    setMessage(undefined);
    setError(undefined);
    setBusy(true);
    try {
      const now = new Date();
      const file = await createBackup(db, now);
      const encrypted = password.length > 0;
      const text = await serializeBackup(file, encrypted ? password : undefined);
      downloadBlob(new Blob([text], { type: "application/json" }), backupFileName(now, encrypted));
      await markBackupDone(db, now);
      setPassword("");
      setMessage(t("backup.exported"));
    } catch (err) {
      setError(errorText(err, t("errors.generic")));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Étape 1 : prépare le fichier à partager. Le chiffrement prend du temps, et le téléphone
   * n'autorise le partage que peu de temps après un appui : on sépare donc les deux étapes.
   */
  async function onPrepareShare() {
    setMessage(undefined);
    setError(undefined);
    setBusy(true);
    try {
      const now = new Date();
      const file = await createBackup(db, now);
      const encrypted = password.length > 0;
      const text = await serializeBackup(file, encrypted ? password : undefined);
      setReadyShare({
        blob: new Blob([text], { type: "application/json" }),
        name: backupFileName(now, encrypted),
      });
    } catch (err) {
      setError(errorText(err, t("errors.generic")));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Étape 2 : ouvre la feuille de partage (Google Drive, OneDrive, Dropbox…). Rien n'est attendu
   * avant l'appel à navigator.share, pour rester dans l'appui de l'utilisateur.
   */
  function onShare() {
    if (!readyShare) return;
    const { blob, name } = readyShare;
    setMessage(undefined);
    setError(undefined);
    shareFile(blob, name)
      .then(async (shared) => {
        if (!shared) return; // l'utilisateur a fermé la feuille de partage
        await markBackupDone(db, new Date());
        setReadyShare(undefined);
        setPassword("");
        setMessage(t("backup.shared"));
      })
      .catch(async (err: unknown) => {
        if (!(err instanceof DOMException && err.name === "NotAllowedError")) {
          setError(errorText(err, t("errors.generic")));
          return;
        }
        // Le navigateur refuse le partage : on enregistre le fichier à la place.
        downloadBlob(blob, name);
        await markBackupDone(db, new Date());
        setReadyShare(undefined);
        setPassword("");
        setMessage(t("backup.sharedFallback"));
      });
  }

  async function onPickFile(files: FileList | null) {
    setMessage(undefined);
    setError(undefined);
    resetImport();
    const file = files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (isEncryptedBackup(text)) {
        setEncryptedText(text);
        return;
      }
      setPrepared(prepareRestore(await readBackupText(text)));
    } catch (err) {
      setError(errorText(err, t("errors.generic")));
    }
  }

  async function onDecrypt() {
    if (!encryptedText) return;
    setError(undefined);
    setBusy(true);
    try {
      setPrepared(prepareRestore(await readBackupText(encryptedText, decryptPassword)));
    } catch (err) {
      setError(errorText(err, t("errors.generic")));
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!prepared) return;
    setError(undefined);
    setBusy(true);
    try {
      const written = await restoreBackup(prepared, mode);
      resetImport();
      setRestored(written);
    } catch (err) {
      setError(errorText(err, t("errors.generic")));
    } finally {
      setBusy(false);
    }
  }

  const replaceBlocked = mode === "replace" && !confirmed;

  return (
    <section className="flex flex-col gap-6">
      <PageTitle className="text-2xl font-bold">{t("backup.title")}</PageTitle>
      <p className="text-sm text-slate-600 dark:text-muted">{t("backup.intro")}</p>

      {reminder !== "none" ? (
        <p
          role="status"
          className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("backup.reminder")}
        </p>
      ) : null}

      <div className="flex flex-col gap-1 text-sm">
        <p>
          {lastBackupAt
            ? t("backup.lastBackup", { date: format(new Date(lastBackupAt), DATE_FORMAT) })
            : t("backup.noBackup")}
        </p>
        {persisted !== undefined ? (
          <p>{persisted ? t("backup.persistedYes") : t("backup.persistedNo")}</p>
        ) : null}
      </div>

      {settings ? (
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/15">
          <h2 className="font-semibold">{t("backup.exportTitle")}</h2>
          <Field label={t("backup.passwordLabel")}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setReadyShare(undefined); // une sauvegarde préparée avec un autre mot de passe n'est plus valable
              }}
              className={inputClass}
              aria-describedby="backup-password-hint"
            />
          </Field>
          <p id="backup-password-hint" className="text-sm text-slate-500">
            {t("backup.passwordHint", { min: MIN_PASSWORD_LENGTH })}
          </p>
          <button
            type="button"
            className={buttonPrimary}
            disabled={busy}
            onClick={() => void onDownload()}
          >
            {t("backup.exportButton")}
          </button>
          {canShareFiles() ? (
            <>
              {readyShare ? (
                <button type="button" className={buttonSecondary} onClick={onShare}>
                  {t("backup.shareButton")}
                </button>
              ) : (
                <button
                  type="button"
                  className={buttonSecondary}
                  disabled={busy}
                  onClick={() => void onPrepareShare()}
                >
                  {t("backup.prepareShare")}
                </button>
              )}
              <p className="text-sm text-slate-500">
                {readyShare ? t("backup.readyToShare") : t("backup.shareHint")}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-white/15">
        <h2 className="font-semibold">{t("backup.importTitle")}</h2>
        <label className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-4 text-center font-medium focus-within:outline focus-within:outline-2 focus-within:outline-accent dark:border-white/15">
          {t("backup.chooseFile")}
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => void onPickFile(e.target.files)}
          />
        </label>

        {encryptedText ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">{t("backup.encryptedNotice")}</p>
            <Field label={t("backup.decryptPasswordLabel")}>
              <input
                type="password"
                autoComplete="current-password"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <button
              type="button"
              className={buttonSecondary}
              disabled={busy || decryptPassword.length === 0}
              onClick={() => void onDecrypt()}
            >
              {t("backup.decrypt")}
            </button>
          </div>
        ) : null}

        {prepared ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {t("backup.preview", {
                count: prepared.count,
                date: format(new Date(prepared.exportedAt), DATE_FORMAT),
              })}
            </p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("backup.modeLegend")}</legend>
              <label className="flex min-h-[44px] items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/15">
                <input
                  type="radio"
                  name="restore-mode"
                  value="merge"
                  checked={mode === "merge"}
                  onChange={() => setMode("merge")}
                  className="mt-1 h-5 w-5"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{t("backup.modeMerge")}</span>
                  <span className="text-sm text-slate-500">{t("backup.modeMergeHint")}</span>
                </span>
              </label>
              <label className="flex min-h-[44px] items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/15">
                <input
                  type="radio"
                  name="restore-mode"
                  value="replace"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="mt-1 h-5 w-5"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{t("backup.modeReplace")}</span>
                  <span className="text-sm text-slate-500">{t("backup.modeReplaceHint")}</span>
                </span>
              </label>
            </fieldset>
            {mode === "replace" ? (
              <label className="flex min-h-[44px] items-center gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="h-5 w-5"
                />
                <span className="text-sm">{t("backup.confirmReplace")}</span>
              </label>
            ) : null}
            <button
              type="button"
              className={buttonPrimary}
              disabled={busy || replaceBlocked}
              onClick={() => void onRestore()}
            >
              {t("backup.restore")}
            </button>
          </div>
        ) : null}

        {restored !== undefined ? (
          <div role="status" className="flex flex-col gap-3 text-sm">
            <p>{t("backup.restored", { count: restored })}</p>
            <Link to="/" className={buttonSecondary + " flex items-center"}>
              {t("backup.goHome")}
            </Link>
          </div>
        ) : null}
      </section>

      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
