import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { type UserAsker } from "./ask_user.ts";

export class AppData {
  readonly file: string;
  readonly userAsker: UserAsker;
  #state: State = new NewState();
  #memoizedEncryptionKey: Uint8Array | undefined = undefined;

  constructor(file: string, userAsker: UserAsker) {
    this.file = file;
    this.userAsker = userAsker;
  }

  get #db(): DatabaseSync {
    if (!(this.#state instanceof OpenedState)) {
      const openedStateName: string = new OpenedState(undefined as unknown as DatabaseSync).name;
      throw new Error(
        `the database is only available in the "${openedStateName}" state, ` +
          `but the current state is: "${this.#state.name}"`,
      );
    }
    return this.#state.db;
  }

  get #salt(): Uint8Array {
    const key = "salt";
    const result = this.#db.prepare("SELECT value FROM settings WHERE key=?").get(key);
    const saltBase64 = result?.["value"]?.valueOf();
    if (typeof saltBase64 !== "string") {
      throw new Error(`invalid "salt" loaded from database: ${saltBase64} [tq8yxth6j4]`);
    }
    return Buffer.from(saltBase64, "base64");
  }

  async #getEncryptionKey(): Promise<Uint8Array> {
    if (typeof this.#memoizedEncryptionKey !== "undefined") {
      return this.#memoizedEncryptionKey;
    }
    const password = await this.userAsker.ask({
      title: "Application Database Password",
      prompt: "Enter the application database password:",
      sensitive: true,
    });
    const passwordBytes = new TextEncoder().encode(password);
    const iterations = 10000;
    const keyLength = 32;
    const key = crypto.pbkdf2Sync(passwordBytes, this.#salt, iterations, keyLength, "sha512");
    this.#memoizedEncryptionKey = key;
    return key;
  }

  open(): void {
    if (!(this.#state instanceof NewState)) {
      const newStateName: string = new NewState().name;
      throw new Error(
        `open() can only be called in the "${newStateName}" state, ` +
          `but the current state is: "${this.#state.name}"`,
      );
    }

    const db = new DatabaseSync(this.file, { enableForeignKeyConstraints: true });

    let initialized = false;
    try {
      initializeDb(db);
      initialized = true;
    } finally {
      if (!initialized) {
        db.close();
      }
    }

    this.#state = new OpenedState(db);
  }

  async insertCredentialsForDomain(domain: string, credentials: unknown): Promise<void> {
    const statement = this.#db.prepare(`INSERT INTO credentials (domain, data) VALUES (?, ?)`);
    const encryptedCredentials = await this.#encrypt(credentials);
    statement.run(domain, encryptedCredentials);
  }

  async getCredentialsForDomain(domain: string): Promise<unknown[]> {
    const queryResults = this.#db
      .prepare(`SELECT data FROM credentials WHERE domain = ?`)
      .all(domain);
    const parsedResults: unknown[] = [];
    for (const queryResult of queryResults) {
      const data = queryResult["data"]?.valueOf();
      if (typeof data === "string") {
        const decryptedData = await this.#decrypt(data);
        parsedResults.push(decryptedData);
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

  async #encrypt(data: unknown): Promise<string> {
    const iv = Buffer.from(generateRandomInitializationVector());
    const dataBytes = new TextEncoder().encode(JSON.stringify(data));
    const encryptionKey = await this.#getEncryptionKey();

    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const cipherText1: string = cipher.update(dataBytes, undefined, "base64");
    const cipherText2: string = cipher.final("base64");
    const cipherText: string = cipherText1 + cipherText2;

    const encryptedBlob = {
      cipherTextBase64: cipherText,
      authTagBase64: cipher.getAuthTag().toString("base64"),
      initializationVectorBase64: iv.toString("base64"),
    } satisfies EncryptedBlob;
    return Buffer.from(new TextEncoder().encode(JSON.stringify(encryptedBlob))).toString("base64");
  }

  async #decrypt(data: string): Promise<unknown> {
    const { cipherTextBase64, authTagBase64, initializationVectorBase64 } = JSON.parse(
      new TextDecoder().decode(Buffer.from(data, "base64")),
    ) as EncryptedBlob;
    const authTag = Buffer.from(authTagBase64, "base64");
    const iv = Buffer.from(initializationVectorBase64, "base64");
    const encryptionKey = await this.#getEncryptionKey();

    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const plainText1 = decipher.update(cipherTextBase64, "base64");
    const plainText2 = decipher.final();
    const plainText = Buffer.concat([plainText1, plainText2]);

    return JSON.parse(new TextDecoder().decode(plainText));
  }
}

interface EncryptedBlob {
  cipherTextBase64: string;
  authTagBase64: string;
  initializationVectorBase64: string;
}

class NewState {
  readonly name = "new" as const;
}

class OpenedState {
  readonly name = "opened" as const;
  readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
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

  const salt = generateRandomSalt().toString("base64");
  db.prepare("INSERT INTO settings (key, value) VALUES ('salt', ?)").run(salt);
}

function generateRandomSalt() {
  // 16 bytes of salt is recommended, so double that!
  return crypto.randomBytes(32);
}

function generateRandomInitializationVector() {
  // 12 bytes is the recommended value for the "aes-256-gcm" cipher.
  return crypto.randomBytes(12);
}
