import type { Browser, Page} from 'puppeteer';

export interface Logger {
  info(...args: unknown[]): unknown;
  warn(...args: unknown[]): unknown;
}

export class TdPuppeteer {

  readonly #logger: Logger;
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
    await page.goto('https://easyweb.td.com/');
  }

  close(): Promise<void> {
    this.#state = this.#transitionToClosed();
    return this.#state.promise ?? Promise.resolve();
  }

  #transitionToClosed(): ClosedState {
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
}

async function closePage(page: Page, logger: Logger): Promise<void> {
  logger.info("Closing TD page");
  try {
    await page.close();
  } catch (error: unknown) {
    logger.warn("Closing TD page failed:", error);
    return;
  }
  logger.info("Closed TD page");
}

async function closePromisedPage(promise: Promise<Page>, logger: Logger): Promise<void> {
  let page: Page;
  try {
    page = await promise;
  } catch (error) {
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

type State = NewState | StartingState | StartedState | ClosedState
