import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../../src/db/database";
import { completeOnboarding } from "../../src/features/onboarding/onboarding-service";
import { createTransaction } from "../../src/features/transactions/transaction-service";
import {
  backupFileName,
  blobToBytes,
  createBackup,
  isEncryptedBackup,
  markBackupDone,
  prepareRestore,
  readBackupText,
  restoreBackup,
  serializeBackup,
} from "../../src/features/backup/backup-service";
import { toBase64 } from "../../src/lib/base64";
import { computeBalances } from "../../src/domain/balance";
import { backupReminder } from "../../src/domain/backup";

const created: AppDatabase[] = [];

function newDb(): AppDatabase {
  const db = new AppDatabase(`test-${crypto.randomUUID()}`);
  created.push(db);
  return db;
}

async function onboard(db: AppDatabase, walletName = "Compte BNI") {
  await completeOnboarding(
    {
      language: "fr",
      baseCurrency: "MGA",
      wallet: {
        name: walletName,
        icon: "🏦",
        color: "#000000",
        group: "bank",
        currency: "MGA",
        initialBalance: 0,
      },
    },
    db,
  );
  const wallets = await db.wallets.toArray();
  const wallet = wallets[0];
  if (!wallet) throw new Error("portefeuille absent");
  return wallet.id;
}

/** Solde calculé de chaque portefeuille, trié par nom : sert de point de comparaison. */
async function balancesOf(db: AppDatabase) {
  const wallets = await db.wallets.toArray();
  const transactions = await db.transactions.toArray();
  const balances = computeBalances(wallets, transactions);
  return wallets
    .map((w) => ({ name: w.name, balance: balances[w.id] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Les Blob ne sont pas stockés ici : fake-indexeddb (tests) ne clone pas fidèlement les Blob jsdom.
 * Le stockage réel des pièces jointes est vérifié en e2e, dans un vrai navigateur.
 */
async function seedSource(db: AppDatabase) {
  const walletId = await onboard(db);
  await createTransaction(
    {
      type: "income",
      amount: 500_000,
      walletId,
      memo: "Salaire",
      attachmentIds: [],
      date: "2026-01-28T09:00:00.000Z",
      status: "posted",
    },
    db,
  );
  await createTransaction(
    {
      type: "expense",
      amount: 150_000,
      walletId,
      memo: "Loyer",
      attachmentIds: [],
      date: "2026-01-05T09:00:00.000Z",
      status: "posted",
    },
    db,
  );
}

beforeEach(() => {
  created.length = 0;
});

afterEach(async () => {
  for (const db of created) await db.delete();
});

describe("rappel de sauvegarde (SPEC §5.14)", () => {
  const now = new Date("2026-11-04T12:00:00.000Z");

  it("pas de rappel sans données", () => {
    expect(backupReminder(undefined, now, false)).toBe("none");
  });

  it("rappel si des données existent et qu'il n'y a jamais eu de sauvegarde", () => {
    expect(backupReminder(undefined, now, true)).toBe("never");
  });

  it("rappel après plus de 7 jours, pas avant", () => {
    expect(backupReminder("2026-10-28T12:00:00.000Z", now, true)).toBe("none");
    expect(backupReminder("2026-10-27T11:00:00.000Z", now, true)).toBe("stale");
    expect(backupReminder("2026-11-03T12:00:00.000Z", now, true)).toBe("none");
  });
});

describe("sauvegarde puis restauration sur une base vierge", () => {
  it("donne exactement les mêmes soldes, les mêmes transactions et la même pièce jointe", async () => {
    const source = newDb();
    await seedSource(source);
    const before = await balancesOf(source);

    const file = await createBackup(source, new Date("2026-11-04T10:00:00.000Z"));
    const text = await serializeBackup(file);

    const target = newDb(); // navigateur vierge : aucune donnée locale
    const prepared = prepareRestore(await readBackupText(text));
    await restoreBackup(prepared, "replace", target);

    expect(await balancesOf(target)).toEqual(before);
    expect(await target.transactions.count()).toBe(2);
  });

  it("une pièce jointe est décodée en Blob avec les mêmes octets", async () => {
    const source = newDb();
    await seedSource(source);
    const file = await createBackup(source);
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const now = "2026-01-05T09:00:00.000Z";
    file.tables.attachments = [
      {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        mime: "image/jpeg",
        name: "ticket.jpg",
        size: bytes.length,
        data: toBase64(bytes),
      },
    ];

    const prepared = prepareRestore(await readBackupText(JSON.stringify(file)));
    const [record] = prepared.records.attachments as unknown as { name: string; blob: Blob }[];
    expect(record?.name).toBe("ticket.jpg");
    if (!record) throw new Error("pièce jointe absente de la sauvegarde");
    expect(Array.from(await blobToBytes(record.blob))).toEqual([1, 2, 3, 250, 251, 252]);
  });

  it("le mode « remplacement » supprime les données locales absentes de la sauvegarde", async () => {
    const source = newDb();
    await seedSource(source);
    const text = await serializeBackup(await createBackup(source));

    const target = newDb();
    await onboard(target, "Ancien compte");
    await restoreBackup(prepareRestore(await readBackupText(text)), "replace", target);

    const names = (await target.wallets.toArray()).map((w) => w.name);
    expect(names).toEqual(["Compte BNI"]);
  });
});

describe("mode fusion", () => {
  it("garde les données locales, ajoute celles de la sauvegarde, sans doublon à la relecture", async () => {
    const source = newDb();
    await seedSource(source);
    const text = await serializeBackup(await createBackup(source));

    const target = newDb();
    await onboard(target, "Compte local");
    const prepared = prepareRestore(await readBackupText(text));
    await restoreBackup(prepared, "merge", target);
    await restoreBackup(prepared, "merge", target);

    const names = (await target.wallets.toArray()).map((w) => w.name).sort();
    expect(names).toEqual(["Compte BNI", "Compte local"]);
    expect(await target.transactions.count()).toBe(2);
    // Les réglages locaux ne sont pas écrasés par la sauvegarde.
    expect(await target.settings.count()).toBe(1);
  });
});

describe("sauvegarde chiffrée (AES-GCM)", () => {
  it("se déchiffre avec le bon mot de passe et refuse les autres", async () => {
    const source = newDb();
    await seedSource(source);
    const file = await createBackup(source);
    const encrypted = await serializeBackup(file, "motdepasse-123");

    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(encrypted).not.toContain("Loyer");

    await expect(readBackupText(encrypted)).rejects.toThrow("Mot de passe requis");
    await expect(readBackupText(encrypted, "mauvais-mot-de-passe")).rejects.toThrow(
      "Mot de passe incorrect",
    );

    const restored = await readBackupText(encrypted, "motdepasse-123");
    expect(restored.exportedAt).toBe(file.exportedAt);
  });

  it("refuse un fichier chiffré modifié", async () => {
    const source = newDb();
    await seedSource(source);
    const encrypted = await serializeBackup(await createBackup(source), "motdepasse-123");
    const envelope = JSON.parse(encrypted) as { data: string };
    const flipped = envelope.data.startsWith("A")
      ? `B${envelope.data.slice(1)}`
      : `A${envelope.data.slice(1)}`;
    envelope.data = flipped;

    await expect(readBackupText(JSON.stringify(envelope), "motdepasse-123")).rejects.toThrow(
      "altéré",
    );
  });

  it("refuse un mot de passe trop court", async () => {
    const source = newDb();
    await seedSource(source);
    await expect(serializeBackup(await createBackup(source), "court")).rejects.toThrow(
      "au moins 8 caractères",
    );
  });
});

describe("validation avant écriture", () => {
  it("refuse un fichier qui n'est pas une sauvegarde", async () => {
    await expect(readBackupText(JSON.stringify({ hello: "world" }))).rejects.toThrow(
      "n'est pas une sauvegarde Money Manager",
    );
    await expect(readBackupText("pas du json")).rejects.toThrow("illisible");
  });

  it("refuse une sauvegarde contenant un montant décimal, sans rien écrire", async () => {
    const source = newDb();
    await seedSource(source);
    const file = await createBackup(source);
    const transactions = file.tables.transactions as Record<string, unknown>[];
    const first = transactions[0];
    if (!first) throw new Error("aucune transaction dans la sauvegarde");
    first.amount = 12.5;

    const target = newDb();
    await onboard(target, "Compte intact");
    const before = await balancesOf(target);

    expect(() => prepareRestore(file)).toThrow("Sauvegarde invalide");
    expect(await balancesOf(target)).toEqual(before);
  });

  it("refuse une sauvegarde où une table est absente", async () => {
    const source = newDb();
    await seedSource(source);
    const file = await createBackup(source);
    delete file.tables.goals;
    await expect(readBackupText(JSON.stringify(file))).rejects.toThrow("« goals » est absente");
  });
});

describe("suivi de la sauvegarde", () => {
  it("markBackupDone enregistre la date sur les réglages", async () => {
    const db = newDb();
    await onboard(db);
    const when = new Date("2026-11-04T10:00:00.000Z");
    await markBackupDone(db, when);
    const settings = await db.settings.toCollection().first();
    expect(settings?.lastBackupAt).toBe(when.toISOString());
  });

  it("nom de fichier daté, mention « chiffre » si chiffré", () => {
    const when = new Date(2026, 10, 4, 10);
    expect(backupFileName(when, false)).toBe("money-manager-2026-11-04.json");
    expect(backupFileName(when, true)).toBe("money-manager-2026-11-04-chiffre.json");
  });
});
