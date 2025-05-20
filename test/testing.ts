import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect } from "chai";

/**
 * Unconditionally returns `undefined`, even though doing so violates the return type.
 *
 * This is useful for setting an object to `undefined` despite its declared typing not allowing
 * this. One use case is setting a value in `before()` and setting it back to `undefined` in
 * `after()`.
 */
export function undefinedValue<T>(): T {
  return undefined as unknown as T;
}

/**
 * Creates a new, empty directory in a location suitable for temporary files.
 * @param prefix a string to incorporate in the name of the temporary directory.
 * @return the path of the newly-created temporary directory.
 */
export function createTempDir(tag: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), tag + "-"));
}

export function expectThrowsContainingStringWithNonAbuttingText(
  func: () => unknown,
  text: string,
): void {
  const expr = new RegExp(`(^|\\W)${text}($|\\W)`);
  expect(func).to.throw(expr);
}
