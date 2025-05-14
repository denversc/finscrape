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
    if (this.#state.name === "started") {
      this.#logger.info("Closing TD page");
      this.#state.page.close().then(() => this.#logger.info("Closed TD page")).catch(error => this.#logger.warn("Closing TD page failed:", error));
    }
    this.#state = new ClosedState();
  }
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
  constructor() {
    super("closed");
  }
}

type State = NewState | StartingState | StartedState | ClosedState
