import { read as getUserInput } from "read";

import { type Logger } from "./logging.ts";

export interface UserAsker {
  ask(options?: Partial<AskOptions>): Promise<string>;
}

export interface AskOptions {
  prompt: string;
  title: string;
  sensitive: boolean;
}

export function resolveOptions(options?: Partial<AskOptions>): AskOptions {
  return {
    prompt: options?.prompt ?? "Please enter some text:",
    title: options?.title ?? "user input",
    sensitive: options?.sensitive ?? false,
  };
}

export function validateUserInput(userInput: unknown, options: AskOptions): string {
  if (typeof userInput === "string") {
    const trimmedUserInput = userInput.trim();
    if (trimmedUserInput.length > 0) {
      return trimmedUserInput;
    }
  }
  throw new Error(`No input given for: ${options.title} [yvf9gf9hrh]`);
}

export class ReadlineUserAsker implements UserAsker {
  readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async ask(options?: Partial<AskOptions>): Promise<string> {
    const resolvedOptions = resolveOptions(options);
    const { prompt, sensitive: silent } = resolvedOptions;
    const userInput = await getUserInput({
      input: process.stdin,
      output: process.stdout,
      prompt,
      silent,
    });
    this.logger.info(`Got response for "${prompt}"`);
    return validateUserInput(userInput, resolvedOptions);
  }
}
