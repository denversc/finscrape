import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect } from "chai";

import { AppData } from "../../src/util/app_data.ts";
import {
  createTempDir,
  expectThrowsContainingStringWithNonAbuttingText,
  undefinedValue,
} from "../testing.ts";

describe("app_data.test.ts [jrrn9dzv7z]", () => {
  let tempDir: string = undefinedValue();
  let dbPath: string = undefinedValue();

  beforeEach(() => {
    tempDir = createTempDir("app_data.test.ts");
    dbPath = path.join(tempDir, "app_data.sqlite");
  });

  afterEach(() => {
    dbPath = undefinedValue();
    const capturedTempDir = tempDir;
    tempDir = undefinedValue();
    if (capturedTempDir) {
      fs.rmSync(capturedTempDir, { recursive: true, force: true });
    }
  });

  it("new AppData() should expose the given path", () => {
    const db = new AppData(dbPath);
    expect(db.file).to.equal(dbPath);
  });

  it("AppData.open() should successfully create a database", () => {
    const db = new AppData(dbPath);
    db.open();
    db.close();
    expect(fs.existsSync(dbPath), `database should exist: ${dbPath}`).to.be.true;
  });

  it("AppData.open() should successfully re-open a database created previously", () => {
    const db1 = new AppData(dbPath);
    db1.open();
    db1.close();

    const db2 = new AppData(dbPath);
    db2.open();
    db2.close();
  });

  it("AppData.open() should throw if the database has an invalid 'application_id'", () => {
    const db1 = new AppData(dbPath);
    db1.open();
    db1.close();

    setApplicationId(dbPath, 1234);

    const db2 = new AppData(dbPath);
    try {
      expectThrowsContainingStringWithNonAbuttingText(() => db2.open(), "1234");
      expectThrowsContainingStringWithNonAbuttingText(() => db2.open(), "application_id");
    } finally {
      db2.close();
    }
  });

  it("AppData.open() should throw if open() has already been called", () => {
    const db = new AppData(dbPath);
    try {
      db.open();
      expectThrowsContainingStringWithNonAbuttingText(() => db.open(), "new");
      expectThrowsContainingStringWithNonAbuttingText(() => db.open(), "state");
    } finally {
      db.close();
    }
  });

  it("AppData.open() should throw if open() is called after close()", () => {
    const db = new AppData(dbPath);
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
    const db1 = new AppData(dbPath);
    db1.open();
    db1.close();

    const oldApplicationId = setInvalidApplicationId(dbPath);

    const db2 = new AppData(dbPath);
    expect(() => db2.open()).to.throw();
    db2.close();

    setApplicationId(dbPath, oldApplicationId);

    const db3 = new AppData(dbPath);
    db3.open();
    db3.close();
  });

  it("AppData.insertCredentialsForDomain() adds the given data", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("foo", "bar");
      const credentials = db.getCredentialsForDomain("foo");
      expect(credentials).to.deep.equal(["bar"]);
    } finally {
      db.close();
    }
  });

  it("AppData.insertCredentialsForDomain() adds rather than overwrites", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("foo", "bar1");
      db.insertCredentialsForDomain("foo", "bar2");
      const credentials = db.getCredentialsForDomain("foo");
      expect(credentials).to.deep.equal(["bar1", "bar2"]);
    } finally {
      db.close();
    }
  });

  it("AppData.insertCredentialsForDomain() isolates values for the given domain", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("foo1", "bar1a");
      db.insertCredentialsForDomain("foo1", "bar1b");
      db.insertCredentialsForDomain("foo2", "bar2a");
      db.insertCredentialsForDomain("foo2", "bar2b");
      const credentials1 = db.getCredentialsForDomain("foo1");
      expect(credentials1, "credentials1").to.deep.equal(["bar1a", "bar1b"]);
      const credentials2 = db.getCredentialsForDomain("foo2");
      expect(credentials2, "credentials2").to.deep.equal(["bar2a", "bar2b"]);
    } finally {
      db.close();
    }
  });

  it("AppData.insertCredentialsForDomain() supports all JSON types for 'data'", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("string", "abc123");
      expect(db.getCredentialsForDomain("string"), "string").to.deep.equal(["abc123"]);
      db.insertCredentialsForDomain("number", 1234);
      expect(db.getCredentialsForDomain("number"), "number").to.deep.equal([1234]);
      db.insertCredentialsForDomain("null", null);
      expect(db.getCredentialsForDomain("null"), "null").to.deep.equal([null]);
      db.insertCredentialsForDomain("true", true);
      expect(db.getCredentialsForDomain("true"), "true").to.deep.equal([true]);
      db.insertCredentialsForDomain("false", false);
      expect(db.getCredentialsForDomain("false"), "false").to.deep.equal([false]);
      db.insertCredentialsForDomain("array", [1, 2, 3, "a", "b"]);
      expect(db.getCredentialsForDomain("array"), "array").to.deep.equal([[1, 2, 3, "a", "b"]]);
      db.insertCredentialsForDomain("object", { a: 42, b: { c: 99 } });
      expect(db.getCredentialsForDomain("object"), "object").to.deep.equal([
        { a: 42, b: { c: 99 } },
      ]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns empty list when no credentials", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      expect(db.getCredentialsForDomain("foo")).to.deep.equal([]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns empty list for unknown domain", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("foo", "bar");
      expect(db.getCredentialsForDomain("zzyzx")).to.deep.equal([]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns credentials for the given domain", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("foo", "bar");
      expect(db.getCredentialsForDomain("foo")).to.deep.equal(["bar"]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() returns credentials ONLY for the given domain", () => {
    const db = new AppData(dbPath);
    db.open();
    try {
      db.insertCredentialsForDomain("foo1", "bar1");
      db.insertCredentialsForDomain("foo2", "bar2");
      expect(db.getCredentialsForDomain("foo1")).to.deep.equal(["bar1"]);
      expect(db.getCredentialsForDomain("foo2")).to.deep.equal(["bar2"]);
    } finally {
      db.close();
    }
  });

  it("AppData.getCredentialsForDomain() persists", () => {
    const db1 = new AppData(dbPath);
    db1.open();
    try {
      db1.insertCredentialsForDomain("foo1", "bar1");
      db1.insertCredentialsForDomain("foo2", "bar2");
    } finally {
      db1.close();
    }

    const db2 = new AppData(dbPath);
    db2.open();
    try {
      expect(db2.getCredentialsForDomain("foo1")).to.deep.equal(["bar1"]);
      expect(db2.getCredentialsForDomain("foo2")).to.deep.equal(["bar2"]);
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
