import { DatabaseSync } from "node:sqlite";

import { base64StringFromUint8Array, uint8ArrayFromBase64String } from "./base64.ts";
import { Crypter } from "./crypt.ts";

export class AppData {
  readonly file: string;
  #state: State = new NewState();

  constructor(file: string) {
    this.file = file;
  }

  #ensureOpenedState(): OpenedState {
    if (this.#state instanceof OpenedState) {
      return this.#state;
    }

    const openedStateName: string = new OpenedState(
      undefined as unknown as DatabaseSync,
      undefined as unknown as Crypter,
    ).name;

    throw new Error(
      `AppData instance is expected to be in the "${openedStateName}" state, ` +
        `but the current state is: "${this.#state.name}"`,
    );
  }

  open(encryptionPassword: string): void {
    if (!(this.#state instanceof NewState)) {
      const newStateName: string = new NewState().name;
      throw new Error(
        `open() can only be called in the "${newStateName}" state, ` +
          `but the current state is: "${this.#state.name}"`,
      );
    }

    const db = new DatabaseSync(this.file, { enableForeignKeyConstraints: true });

    let initialized = false;
    let crypter: Crypter;
    try {
      initializeDb(db);
      initialized = true;
      crypter = setupEncryption(db, encryptionPassword);
    } finally {
      if (!initialized) {
        db.close();
      }
    }

    this.#state = new OpenedState(db, crypter);
  }

  insertCredentialsForDomain(domain: string, credentials: unknown): void {
    const { db, crypter } = this.#ensureOpenedState();
    const statement = db.prepare(`INSERT INTO credentials (domain, data) VALUES (?, ?)`);
    const encryptedCredentials = crypter.encryptToBase64(credentials);
    statement.run(domain, encryptedCredentials);
  }

  getCredentialsForDomain<T>(domain: string): T[] {
    const { db, crypter } = this.#ensureOpenedState();
    const queryResults = db.prepare(`SELECT data FROM credentials WHERE domain = ?`).all(domain);
    const parsedResults: T[] = [];
    for (const queryResult of queryResults) {
      const encryptedCredentials = queryResult["data"]?.valueOf();
      if (typeof encryptedCredentials === "string") {
        const credentials: T = crypter.decryptFromBase64(encryptedCredentials);
        parsedResults.push(credentials);
      }
    }
    return parsedResults;
  }

  close(): void {
    const oldState = this.#state;
    this.#state = new ClosedState();
    if (oldState instanceof OpenedState) {
      oldState.db.close();
    }
  }
}

class NewState {
  readonly name = "new" as const;
}

class OpenedState {
  readonly name = "opened" as const;
  readonly db: DatabaseSync;
  readonly crypter: Crypter;

  constructor(db: DatabaseSync, crypter: Crypter) {
    this.db = db;
    this.crypter = crypter;
  }
}

class ClosedState {
  readonly name = "closed" as const;
}

type State = NewState | OpenedState | ClosedState;

function initializeDb(db: DatabaseSync): void {
  verifyOrSetApplicationId(db);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA encoding = 'UTF-8'");
  db.exec("PRAGMA foreign_keys = ON");
  migrateDb(db);
}

function setupEncryption(db: DatabaseSync, encryptionPassword: string): Crypter {
  const salt = getBinarySetting(db, "salt");
  if (salt) {
    return Crypter.fromPasswordAndSalt(encryptionPassword, salt);
  }

  const { crypter, salt: newSalt } = Crypter.fromPassword(encryptionPassword);
  setBinarySetting(db, "salt", newSalt);
  return crypter;
}

function verifyOrSetApplicationId(db: DatabaseSync): void {
  const retrievedApplicationId = getPragmaAsNumber(db, "application_id");
  if (typeof retrievedApplicationId === "undefined") {
    db.exec(`PRAGMA application_id = ${applicationId}`);
  } else if (retrievedApplicationId !== applicationId) {
    throw new Error(
      `incorrect "application_id" found in sqlite database: ${retrievedApplicationId} ` +
        `(expected: ${applicationId}) [dex9d37c3e]`,
    );
  }
}

const applicationId = 0x62d601b9 as const;

function getPragmaAsNumber(db: DatabaseSync, pragma: string): number | undefined {
  const pragmaResult = db.prepare(`PRAGMA ${pragma}`).get();
  if (!pragmaResult) {
    return undefined;
  }
  const value = pragmaResult[pragma]?.valueOf();
  if (!value) {
    return undefined;
  }
  return value as number;
}

function migrateDb(db: DatabaseSync): void {
  const userVersion = getPragmaAsNumber(db, "user_version");
  if (typeof userVersion === "undefined") {
    createTables(db);
    db.exec(`PRAGMA user_version = 1`);
  } else if (userVersion !== 1) {
    throw new Error(
      `unrecognized "user_version": ${userVersion} ` + "(the only known value is 1) [wz7w6tbkhd]",
    );
  }
}

function createTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      data TEXT
    )
  `);
  db.exec(`
    CREATE TABLE settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT
    )
  `);
}

function getSetting<T>(db: DatabaseSync, key: string): T | null {
  const result = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  const value = result?.["value"]?.valueOf() ?? null;
  if (typeof value !== "string") {
    return null;
  }
  return JSON.parse(value);
}

function setSetting<T>(db: DatabaseSync, key: string, value: T): void {
  const jsonEncodedValue = JSON.stringify(value);
  db.prepare(
    `
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=?
  `,
  ).run(key, jsonEncodedValue, jsonEncodedValue);
}

function getBinarySetting(db: DatabaseSync, key: string): Uint8Array | null {
  const value: string | null = getSetting(db, key);
  if (value === null) {
    return null;
  }
  return uint8ArrayFromBase64String(value);
}

function setBinarySetting(db: DatabaseSync, key: string, value: Uint8Array): void {
  return setSetting(db, key, base64StringFromUint8Array(value));
}
