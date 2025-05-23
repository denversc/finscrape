import path from "node:path";

import type { Browser, ElementHandle, Page } from "puppeteer";

import { getTextContent } from "./browser/evaluate_functions.ts";
import { elementBySelectorAndTextContent } from "./browser/wait_for_functions.ts";
import type { Logger } from "./logging.ts";

export class PuppeteerHelper {
  readonly logger: Logger;
  readonly abortController: AbortController = new AbortController();

  #state: State = new NewState();

  constructor(logger: Logger) {
    this.logger = logger;
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

    const cdpSession = await page.createCDPSession();
    await cdpSession.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      eventsEnabled: true,
      downloadPath: path.join(import.meta.dirname, "..", ".."),
    });
    cdpSession.on("Browser.downloadWillBegin", event => {
      this.logger.info(`Downloading "${event.url}" to local file: "${event.suggestedFilename}"`);
    });
    cdpSession.on("Browser.downloadProgress", event => {
      if (event.state === "completed") {
        this.logger.info("Download completed");
      }
    });
  }

  close(): Promise<void> {
    this.#state = this.#transitionToClosed();
    return this.#state.promise ?? Promise.resolve();
  }

  #transitionToClosed(): ClosedState {
    this.abortController.abort("closed");

    if (this.#state.name === "new") {
      return new ClosedState(null);
    } else if (this.#state.name === "starting") {
      const promise = closePromisedPage(this.#state.promise, this.logger);
      return new ClosedState(promise);
    } else if (this.#state.name === "started") {
      const promise = closePage(this.#state.page, this.logger);
      return new ClosedState(promise);
    } else if (this.#state.name === "closed") {
      return this.#state;
    } else {
      throw new Error(`internal error: unknown state: ${this.#state} [mdkxnfn6vd]`);
    }
  }

  get page(): Page {
    if (this.#state.name !== "started") {
      throw new Error(
        `The puppeteer Page object is only available in the "started" state, ` +
          `but the current state is: "${this.#state.name}" [qagngenazb]`,
      );
    }
    return this.#state.page;
  }

  async gotoUrl(url: string): Promise<void> {
    this.logger.info(`Navigating browser to URL: ${url}`);
    await this.page.goto(url, { timeout: 0, waitUntil: ["load", "networkidle0"] });
  }

  clickWhenAndIfVisibleBySelectorAsync(args: { selector: string; description: string }): void {
    const { selector, description } = args;
    this.logger.info(`Waiting for element "${description ?? selector}" to become visible`);

    const asyncFunction = async () => {
      const elementHandle = await this.page.waitForSelector(selector, {
        timeout: 0,
        signal: this.abortController.signal,
        visible: true,
      });
      this.logger.info(`Clicking element "${description ?? selector}"`);
      await elementHandle!.click();
    };
    asyncFunction().catch(error => {
      this.logger.warn(
        `Waiting for or clicking element "${description ?? selector}" FAILED:`,
        error,
      );
    });
  }

  async waitForElementWithIdToBeVisible(elementId: string): Promise<void> {
    this.logger.info(`Waiting for element with ID "${elementId}" to become visible`);
    const selector = selectorForElementWithId(elementId);
    await this.page.waitForSelector(selector, { visible: true, timeout: 0 });
    this.logger.info(`Element with ID "${elementId}" is now visible; continuing.`);
  }

  async typeTextIntoElementWithId(args: TypeTextIntoElementArgs): Promise<void> {
    const { elementId, text } = args;
    const sensitive = args.sensitive ?? false;
    const sanitizedText = sensitive ? "<redacted>" : text;
    this.logger.info(`Typing text "${sanitizedText}" into element with ID "${elementId}"`);
    const selector = selectorForElementWithId(elementId);
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(
        `Typing text "${sanitizedText}" into element with ID "${elementId}" FAILED: ` +
          "element not found [s5vg2hykg4]",
      );
    }
    await element.type(text);
  }

  async clickButtonWithText(
    buttonText: string,
    options?: { waitForNavigation?: boolean; waitForVisible?: boolean },
  ): Promise<void> {
    await this.clickElementWithText({ ...options, selector: "button", text: buttonText });
  }

  async clickElementWithText(args: {
    selector: string;
    text: string;
    waitForNavigation?: boolean;
    waitForNetworkIdle?: boolean;
    waitForVisible?: boolean;
  }): Promise<void> {
    const { selector, text } = args;
    const waitForVisible = args.waitForVisible ?? false;
    const waitForNavigation = args.waitForNavigation ?? false;
    const waitForNetworkIdle = args.waitForNetworkIdle ?? false;

    if (waitForVisible) {
      await this.waitForElement({ selector, text });
    }

    this.logger.info(
      `Clicking element matching selector "${selector}" ` + `and text content: "${text}"`,
    );
    const elements = await this.page.$$(selector);
    const matchingElements: Array<(typeof elements)[number]> = [];
    for (const element of elements) {
      if (!(await element.isVisible())) {
        continue;
      }
      const textContent = await element.evaluate(getTextContent);
      if (typeof textContent !== "string") {
        continue;
      }
      if (textContent.trim().toLowerCase() === text.trim().toLowerCase()) {
        matchingElements.push(element);
      }
    }
    if (matchingElements.length !== 1) {
      throw new Error(
        `Clicking element matching selector "${selector}" ` +
          `and text content: "${text}" FAILED: ` +
          `expected to find exactly 1 matching element, ` +
          `but found ${matchingElements.length} [fzt64ga7nw]`,
      );
    }

    const matchingElement = matchingElements[0]!;
    const promises: Promise<unknown>[] = [];
    if (waitForNavigation) {
      promises.push(
        this.page.waitForNavigation({ timeout: 0, waitUntil: ["load", "networkidle0"] }),
      );
    }
    if (waitForNetworkIdle) {
      promises.push(this.page.waitForNetworkIdle({ timeout: 0 }));
    }
    promises.push(matchingElement.click());
    await Promise.all(promises);
  }

  async clickButtonWithSelector(selector: string): Promise<void> {
    this.logger.info(`Clicking button matching selector: "${selector}"`);
    const elements = await this.page.$$(selector);
    const matchingElements: Array<(typeof elements)[number]> = [];
    for (const element of elements) {
      if (await element.isVisible()) {
        matchingElements.push(element);
      }
    }
    if (matchingElements.length !== 1) {
      throw new Error(
        `Clicking button with selector: "${selector}" FAILED: ` +
          `expected to find exactly 1 button with this selector, ` +
          `but found ${matchingElements.length} [bshx3gf9mp]`,
      );
    }

    const button = matchingElements[0]!;
    await button.click();
  }

  async waitForElement(args: { selector: string; text: string }): Promise<void> {
    const { selector, text } = args;
    this.logger.info(
      `Waiting for element matching selector "${selector}" ` + `with text content: "${text}"`,
    );
    await this.page.waitForFunction(
      elementBySelectorAndTextContent,
      { timeout: 0 },
      selector,
      text,
    );
  }

  async getElementsAndTextContentMatchingSelector(
    selector: string,
  ): Promise<Array<{ element: ElementHandle; textContent: string }>> {
    const elements = await this.page.$$(selector);
    const result: Array<{ element: ElementHandle; textContent: string }> = [];
    for (const element of elements) {
      const textContent = await element.evaluate(getTextContent);
      result.push({ element, textContent: textContent ?? "" });
    }
    return result;
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

export interface TypeTextIntoElementArgs {
  elementId: string;
  text: string;
  sensitive?: boolean;
}
