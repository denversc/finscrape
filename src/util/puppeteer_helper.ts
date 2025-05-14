import type { Browser, Page } from "puppeteer";

import { getTextContent } from "./browser/evaluate_functions.ts";
import type { Logger } from "./logging.ts";

export class PuppeteerHelper {
  readonly #logger: Logger;
  readonly #abortController = new AbortController();

  #state: State = new NewState();

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  async start(browser: Browser): Promise<void> {
    if (this.#state.name !== "new") {
      throw new Error(`unexpected state: "${this.#state.name}" (expected "new")`);
    }
    const newPagePromise = browser.newPage();
    this.#state = new StartingState(newPagePromise);
    const page = await newPagePromise;
    this.#state = new StartedState(page);
    await page.setViewport(null);
  }

  close(): Promise<void> {
    this.#state = this.#transitionToClosed();
    return this.#state.promise ?? Promise.resolve();
  }

  #transitionToClosed(): ClosedState {
    this.#abortController.abort("closed");

    if (this.#state.name === "new") {
      return new ClosedState(null);
    } else if (this.#state.name === "starting") {
      const promise = closePromisedPage(this.#state.promise, this.#logger);
      return new ClosedState(promise);
    } else if (this.#state.name === "started") {
      const promise = closePage(this.#state.page, this.#logger);
      return new ClosedState(promise);
    } else if (this.#state.name === "closed") {
      return this.#state;
    } else {
      throw new Error(`internal error: unknown state: ${this.#state} [mdkxnfn6vd]`);
    }
  }

  get #page(): Page {
    if (this.#state.name !== "started") {
      throw new Error(
        `The puppeteer Page object is only available in the "started" state, ` +
          `but the current state is: "${this.#state.name}" [qagngenazb]`,
      );
    }
    return this.#state.page;
  }

  async gotoUrl(url: string): Promise<void> {
    this.#logger.info(`Navigating browser to URL: ${url}`);
    await this.#page.goto(url, { timeout: 0, waitUntil: ["load", "networkidle0"] });
  }

  clickWhenAndIfVisibleBySelectorAsync(args: { selector: string; description: string }): void {
    const { selector, description } = args;
    this.#logger.info(`Waiting for element "${description ?? selector}" to become visible`);

    const asyncFunction = async () => {
      const elementHandle = await this.#page.waitForSelector(selector, {
        timeout: 0,
        signal: this.#abortController.signal,
        visible: true,
      });
      this.#logger.info(`Clicking element "${description ?? selector}"`);
      await elementHandle!.click();
    };
    asyncFunction().catch(error => {
      this.#logger.warn(
        `Waiting for or clicking element "${description ?? selector}" FAILED:`,
        error,
      );
    });
  }

  async waitForElementWithIdToBeVisible(elementId: string): Promise<void> {
    this.#logger.info(`Waiting for element with ID "${elementId}" to become visible`);
    const selector = selectorForElementWithId(elementId);
    await this.#page.waitForSelector(selector, { visible: true, timeout: 0 });
    this.#logger.info(`Element with ID "${elementId}" is now visible; continuing.`);
  }

  async typeTextIntoElementWithId(args: { elementId: string; text: string }): Promise<void> {
    const { elementId, text } = args;
    this.#logger.info(`Typing text "${text}" into element with ID "${elementId}"`);
    const selector = selectorForElementWithId(elementId);
    const element = await this.#page.$(selector);
    if (!element) {
      throw new Error(
        `Typing text "${text}" into element with ID "${elementId}" FAILED: ` +
          "element not found [s5vg2hykg4]",
      );
    }
    const inputElement = await element.toElement("input");
    await inputElement.type(text);
  }

  async clickButtonWithText(buttonText: string): Promise<void> {
    this.#logger.info(`Clicking button with text: "${buttonText}"`);
    const elements = await this.#page.$$("button");
    const matchingElements: Array<(typeof elements)[number]> = [];
    for (const element of elements) {
      if (!(await element.isVisible())) {
        continue;
      }
      const textContent = await element.evaluate(getTextContent);
      if (typeof textContent !== "string") {
        continue;
      }
      if (textContent.trim().toLowerCase() === buttonText.trim().toLowerCase()) {
        matchingElements.push(element);
      }
    }
    if (matchingElements.length !== 1) {
      throw new Error(
        `Clicking button with text: "${buttonText}" FAILED: ` +
          `expected to find exactly 1 button with this text, but found ${matchingElements.length} ` +
          "[fzt64ga7nw]",
      );
    }
    await matchingElements[0]!.click();
  }
}

function selectorForElementWithId(id: string): string {
  return `#${id}`;
}

async function closePage(page: Page, logger: Logger): Promise<void> {
  logger.info(`Closing browser page: ${page.url()}`);
  try {
    await page.close();
  } catch (error: unknown) {
    logger.warn(`Closing browser page "${page.url()}" failed:`, error);
    return;
  }
  logger.info(`Closing browser page "${page.url()}" done`);
}

async function closePromisedPage(promise: Promise<Page>, logger: Logger): Promise<void> {
  let page: Page;
  try {
    page = await promise;
  } catch (_) {
    // Opening the page failed; therefore, there is nothing to "close"
    return;
  }
  await closePage(page, logger);
}

type StateName = "new" | "starting" | "started" | "closed";

abstract class BaseState<T extends StateName> {
  readonly name: T;

  protected constructor(name: T) {
    this.name = name;
  }
}

class NewState extends BaseState<"new"> {
  constructor() {
    super("new");
  }
}

class StartingState extends BaseState<"starting"> {
  readonly promise: Promise<Page>;
  constructor(promise: Promise<Page>) {
    super("starting");
    this.promise = promise;
  }
}

class StartedState extends BaseState<"started"> {
  readonly page: Page;

  constructor(page: Page) {
    super("started");
    this.page = page;
  }
}

class ClosedState extends BaseState<"closed"> {
  readonly promise: Promise<void> | null;
  constructor(promise: Promise<void> | null) {
    super("closed");
    this.promise = promise;
  }
}

type State = NewState | StartingState | StartedState | ClosedState;
