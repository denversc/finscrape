import type { Browser, ElementHandle, Page } from 'puppeteer';

import type { Logger } from './logging.ts';

export type PuppeteerHelperFunction = (
  page: Page,
  abortSignal: AbortSignal,
  logger: Logger,
) => unknown;

export class PuppeteerHelper {
  readonly #url: string;
  readonly #func: PuppeteerHelperFunction;
  readonly #logger: Logger;

  #state: State = new NewState();

  constructor(url: string, func: PuppeteerHelperFunction, logger: Logger) {
    this.#url = url;
    this.#func = func;
    this.#logger = logger;
  }

  async run(browser: Browser): Promise<void> {
    if (this.#state.name !== 'new') {
      throw new Error(`unexpected state: "${this.#state.name}" (expected "new")`);
    }
    const abortController = new AbortController();
    const newPagePromise = browser.newPage();
    this.#state = new StartingState(newPagePromise, abortController);
    const page = await newPagePromise;
    this.#state = new StartedState(page, this.#state.abortController);
    await page.setViewport(null);
    this.#logger.info(`Navigating browser to URL: ${this.#url}`);
    await page.goto(this.#url, { timeout: 0, waitUntil: ['load', 'networkidle0'] });
    await this.#func(page, abortController.signal, this.#logger);
  }

  close(): Promise<void> {
    this.#state = this.#transitionToClosed();
    return this.#state.promise ?? Promise.resolve();
  }

  #transitionToClosed(): ClosedState {
    if ('abortController' in this.#state) {
      this.#state.abortController.abort('closed');
    }

    if (this.#state.name === 'new') {
      return new ClosedState(null);
    } else if (this.#state.name === 'starting') {
      const promise = closePromisedPage(this.#state.promise, this.#logger);
      return new ClosedState(promise);
    } else if (this.#state.name === 'started') {
      const promise = closePage(this.#state.page, this.#logger);
      return new ClosedState(promise);
    } else if (this.#state.name === 'closed') {
      return this.#state;
    } else {
      throw new Error(`internal error: unknown state: ${this.#state} [mdkxnfn6vd]`);
    }
  }
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
  } catch (error) {
    // Opening the page failed; therefore, there is nothing to "close"
    return;
  }
  await closePage(page, logger);
}

type StateName = 'new' | 'starting' | 'started' | 'closed';

abstract class BaseState<T extends StateName> {
  readonly name: T;

  protected constructor(name: T) {
    this.name = name;
  }
}

class NewState extends BaseState<'new'> {
  constructor() {
    super('new');
  }
}

class StartingState extends BaseState<'starting'> {
  readonly abortController;
  readonly promise: Promise<Page>;
  constructor(promise: Promise<Page>, abortController: AbortController) {
    super('starting');
    this.promise = promise;
    this.abortController = abortController;
  }
}

class StartedState extends BaseState<'started'> {
  readonly page: Page;
  readonly abortController: AbortController;

  constructor(page: Page, abortController: AbortController) {
    super('started');
    this.page = page;
    this.abortController = abortController;
  }
}

class ClosedState extends BaseState<'closed'> {
  readonly promise: Promise<void> | null;
  constructor(promise: Promise<void> | null) {
    super('closed');
    this.promise = promise;
  }
}

type State = NewState | StartingState | StartedState | ClosedState;

export abstract class BasePuppeteerHelperFunc {
  protected readonly page: Page;
  protected readonly abortSignal: AbortSignal;
  protected readonly logger: Logger;

  constructor(page: Page, abortSignal: AbortSignal, logger: Logger) {
    this.page = page;
    this.abortSignal = abortSignal;
    this.logger = logger;
  }

  protected clickWhenAndIfVisibleBySelectorAsync(selector: string, description?: string): void {
    this.logger.info(`Waiting for element "${description ?? selector}" to become visible`);

    const asyncFunction = async () => {
      const elementHandle = await this.page.waitForSelector(selector, {
        timeout: 0,
        signal: this.abortSignal,
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
}
