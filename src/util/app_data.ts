import { DatabaseSync } from "node:sqlite";

export class AppData {
  readonly file: string;
  #state: State = new NewState();

  constructor(file: string) {
    this.file = file;
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

  insertCredentialsForDomain(domain: string, credentials: unknown): void {
    const statement = this.#db.prepare(`INSERT INTO credentials (domain, data) VALUES (?, ?)`);
    statement.run(`${domain}`, JSON.stringify(credentials));
  }

  getCredentialsForDomain(domain: string): unknown[] {
    const queryResults = this.#db
      .prepare(`SELECT data FROM credentials WHERE domain = ?`)
      .all(`${domain}`);
    const parsedResults: unknown[] = [];
    for (const queryResult of queryResults) {
      const data = queryResult["data"]?.valueOf();
      if (typeof data === "string") {
        let parsedData: unknown;
        try {
          parsedData = JSON.parse(data);
        } catch (_) {
          continue;
        }
        parsedResults.push(parsedData);
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
      domain TEXT,
      data TEXT
    )
  `);
}
