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

  /**
   * « download » enregistre le fichier ; « share » ouvre la feuille de partage du téléphone
   * (Google Drive, OneDrive, Dropbox, e-mail…). Aucun compte ni clé n'est nécessaire dans l'app.
   */
  async function onExport(target: "download" | "share") {
    setMessage(undefined);
    setError(undefined);
    setBusy(true);
    try {
      const now = new Date();
      const file = await createBackup(db, now);
      const encrypted = password.length > 0;
      const text = await serializeBackup(file, encrypted ? password : undefined);
      const name = backupFileName(now, encrypted);
      const blob = new Blob([text], { type: "application/json" });

      if (target === "share") {
        const shared = await shareFile(blob, name);
        if (!shared) return; // l'utilisateur a fermé la feuille de partage
      } else {
        downloadBlob(blob, name);
      }
      await markBackupDone(db, now);
      setPassword("");
      setMessage(t(target === "share" ? "backup.shared" : "backup.exported"));
    } catch (err) {
      setError(errorText(err, t("errors.generic")));
    } finally {
      setBusy(false);
    }
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
      <h1 className="text-2xl font-bold">{t("backup.title")}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("backup.intro")}</p>

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
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h2 className="font-semibold">{t("backup.exportTitle")}</h2>
          <Field label={t("backup.passwordLabel")}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            onClick={() => void onExport("download")}
          >
            {t("backup.exportButton")}
          </button>
          {canShareFiles() ? (
            <>
              <button
                type="button"
                className={buttonSecondary}
                disabled={busy}
                onClick={() => void onExport("share")}
              >
                {t("backup.shareButton")}
              </button>
              <p className="text-sm text-slate-500">{t("backup.shareHint")}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <h2 className="font-semibold">{t("backup.importTitle")}</h2>
        <input
          type="file"
          accept=".json,application/json"
          aria-label={t("backup.chooseFile")}
          onChange={(e) => void onPickFile(e.target.files)}
          className="min-h-[44px]"
        />

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
              <label className="flex min-h-[44px] items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
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
              <label className="flex min-h-[44px] items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
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
