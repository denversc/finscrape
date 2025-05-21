import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect } from "chai";

import { type AskOptions, type UserAsker } from "../src/util/ask_user.ts";

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
 * @param tag a string to incorporate in the name of the temporary directory.
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

export class StubUserAsker implements UserAsker {
  #responsesByPrompt = new Map<RegExp, string>();

  registerPromptResponse(prompt: RegExp, response: string): void {
    this.#responsesByPrompt.set(prompt, response);
  }

  async ask(options?: Partial<AskOptions>): Promise<string> {
    const prompt = options?.prompt;
    if (!prompt) {
      throw new Error("don't know how to respond when no prompt is specified [ffrc8jsvgq]");
    }
    for (const [expr, response] of this.#responsesByPrompt) {
      if (prompt.match(expr)) {
        return response;
      }
    }
    throw new Error(`no response for prompt: "${prompt}" [yfkdzjew8s]`);
  }
}

export function loadExampleUnicodeBytes(): Uint8Array {
  const filePath = path.join(import.meta.dirname, "UTF-8-test.txt");
  return fs.readFileSync(filePath);
}
