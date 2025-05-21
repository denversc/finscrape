import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect } from "chai";

import { AppData } from "../../src/util/app_data.ts";
import {
  createTempDir,
  expectThrowsContainingStringWithNonAbuttingText,
  undefinedValue,
  StubUserAsker,
} from "../testing.ts";

describe("app_data.test.ts [jrrn9dzv7z]", () => {
  let tempDir: string = undefinedValue();
  let dbPath: string = undefinedValue();
  let userAsker: StubUserAsker = undefinedValue();

  beforeEach(() => {
    tempDir = createTempDir("app_data.test.ts");
    dbPath = path.join(tempDir, "app_data.sqlite");
    userAsker = new StubUserAsker();
    userAsker.registerPromptResponse(/username/i, "untqvhntkk");
    userAsker.registerPromptResponse(/password/i, "pwszd8ns5k");
  });

  afterEach(() => {
    dbPath = undefinedValue();
    const capturedTempDir = tempDir;
    tempDir = undefinedValue();
    userAsker = undefinedValue();
    if (capturedTempDir) {
      fs.rmSync(capturedTempDir, { recursive: true, force: true });
    }
  });

  it("new AppData() should expose the arguments given to the constructor", () => {
    const db = new AppData(dbPath, userAsker);
    expect(db.file).to.equal(dbPath);
    expect(db.userAsker).to.equal(userAsker);
  });

  it("AppData.open() should successfully create a database", () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    db.close();
    expect(fs.existsSync(dbPath), `database should exist: ${dbPath}`).to.be.true;
  });

  it("AppData.open() should successfully re-open a database created previously", () => {
    const db1 = new AppData(dbPath, userAsker);
    db1.open();
    db1.close();

    const db2 = new AppData(dbPath, userAsker);
    db2.open();
    db2.close();
  });

  it("AppData.open() should throw if the database has an invalid 'application_id'", () => {
    const db1 = new AppData(dbPath, userAsker);
    db1.open();
    db1.close();

    setApplicationId(dbPath, 1234);

    const db2 = new AppData(dbPath, userAsker);
    try {
      expectThrowsContainingStringWithNonAbuttingText(() => db2.open(), "1234");
      expectThrowsContainingStringWithNonAbuttingText(() => db2.open(), "application_id");
    } finally {
      db2.close();
    }
  });

  it("AppData.open() should throw if open() has already been called", () => {
    const db = new AppData(dbPath, userAsker);
    try {
      db.open();
      expectThrowsContainingStringWithNonAbuttingText(() => db.open(), "new");
      expectThrowsContainingStringWithNonAbuttingText(() => db.open(), "state");
    } finally {
      db.close();
    }
  });

  it("AppData.open() should throw if open() is called after close()", () => {
    const db = new AppData(dbPath, userAsker);
    try {
      db.open();
      db.close();
      expectThrowsContainingStringWithNonAbuttingText(() => db.open(), "closed");
      expectThrowsContainingStringWithNonAbuttingText(() => db.open(), "state");
    } finally {
      db.close();
    }
  });

  it("AppData.open() should be able to be called again after a failure", () => {
    const db1 = new AppData(dbPath, userAsker);
    db1.open();
    db1.close();

    const oldApplicationId = setInvalidApplicationId(dbPath);

    const db2 = new AppData(dbPath, userAsker);
    expect(() => db2.open()).to.throw();
    db2.close();

    setApplicationId(dbPath, oldApplicationId);

    const db3 = new AppData(dbPath, userAsker);
    db3.open();
    db3.close();
  });

  it("AppData.insertCredentialsForDomain() adds the given data", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("foo", "bar");
      const credentials = await db.getCredentialsForDomain("foo");
      expect(credentials).to.deep.equal(["bar"]);
    } finally {
      db.close();
    }
  });

  it("AppData.insertCredentialsForDomain() adds rather than overwrites", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("foo", "bar1");
      await db.insertCredentialsForDomain("foo", "bar2");
      const credentials = await db.getCredentialsForDomain("foo");
      expect(credentials).to.deep.equal(["bar1", "bar2"]);
    } finally {
      db.close();
    }
  });

  it("AppData.insertCredentialsForDomain() isolates values for the given domain", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("foo1", "bar1a");
      await db.insertCredentialsForDomain("foo1", "bar1b");
      await db.insertCredentialsForDomain("foo2", "bar2a");
      await db.insertCredentialsForDomain("foo2", "bar2b");
      const credentials1 = await db.getCredentialsForDomain("foo1");
      expect(credentials1, "credentials1").to.deep.equal(["bar1a", "bar1b"]);
      const credentials2 = await db.getCredentialsForDomain("foo2");
      expect(credentials2, "credentials2").to.deep.equal(["bar2a", "bar2b"]);
    } finally {
      db.close();
    }
  });

  it("AppData.insertCredentialsForDomain() supports all JSON types for 'data'", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("string", "abc123");
      expect(await db.getCredentialsForDomain("string"), "string").to.deep.equal(["abc123"]);
      await db.insertCredentialsForDomain("number", 1234);
      expect(await db.getCredentialsForDomain("number"), "number").to.deep.equal([1234]);
      await db.insertCredentialsForDomain("null", null);
      expect(await db.getCredentialsForDomain("null"), "null").to.deep.equal([null]);
      await db.insertCredentialsForDomain("true", true);
      expect(await db.getCredentialsForDomain("true"), "true").to.deep.equal([true]);
      await db.insertCredentialsForDomain("false", false);
      expect(await db.getCredentialsForDomain("false"), "false").to.deep.equal([false]);
      await db.insertCredentialsForDomain("array", [1, 2, 3, "a", "b"]);
      expect(await db.getCredentialsForDomain("array"), "array").to.deep.equal([
        [1, 2, 3, "a", "b"],
      ]);
      await db.insertCredentialsForDomain("object", { a: 42, b: { c: 99 } });
      expect(await db.getCredentialsForDomain("object"), "object").to.deep.equal([
        { a: 42, b: { c: 99 } },
      ]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns empty list when no credentials", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      expect(await db.getCredentialsForDomain("foo")).to.deep.equal([]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns empty list for unknown domain", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("foo", "bar");
      expect(await db.getCredentialsForDomain("zzyzx")).to.deep.equal([]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns credentials for the given domain", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("foo", "bar");
      expect(await db.getCredentialsForDomain("foo")).to.deep.equal(["bar"]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns credentials ONLY for the given domain", async () => {
    const db = new AppData(dbPath, userAsker);
    db.open();
    try {
      await db.insertCredentialsForDomain("foo1", "bar1");
      await db.insertCredentialsForDomain("foo2", "bar2");
      expect(await db.getCredentialsForDomain("foo1")).to.deep.equal(["bar1"]);
      expect(await db.getCredentialsForDomain("foo2")).to.deep.equal(["bar2"]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() persists", async () => {
    const db1 = new AppData(dbPath, userAsker);
    db1.open();
    try {
      await db1.insertCredentialsForDomain("foo1", "bar1");
      await db1.insertCredentialsForDomain("foo2", "bar2");
    } finally {
      db1.close();
    }

    const db2 = new AppData(dbPath, userAsker);
    db2.open();
    try {
      expect(await db2.getCredentialsForDomain("foo1")).to.deep.equal(["bar1"]);
      expect(await db2.getCredentialsForDomain("foo2")).to.deep.equal(["bar2"]);
    } finally {
      db2.close();
    }
  });
});

function setApplicationId(dbPath: string, applicationId: number): number {
  const sqliteDb = new DatabaseSync(dbPath);
  const oldApplicationId = sqliteDb.prepare("PRAGMA application_id").get()?.["application_id"] ?? 0;
  sqliteDb.exec(`PRAGMA application_id = ${applicationId}`);
  sqliteDb.close();
  return oldApplicationId as number;
}

function setInvalidApplicationId(dbPath: string): number {
  return setApplicationId(dbPath, 9876);
}
