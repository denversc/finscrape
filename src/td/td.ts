import type { Browser, ElementHandle, JSHandle, Page } from 'puppeteer';
import { elementBySelectorAndTextContent } from '../browser/wait_for_functions.ts';
import { textContent } from '../browser/evaluate_functions.ts';

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

  async run(browser: Browser): Promise<void> {
    if (this.#state.name !== 'new') {
      throw new Error(`unexpected state: "${this.#state.name}" (expected "new")`);
    }
    const abortController = new AbortController();
    const newPagePromise = browser.newPage();
    this.#state = new StartingState(newPagePromise, abortController);
    const page = await newPagePromise;
    this.#state = new StartedState(page, this.#state.abortController);
    await new TdPageController(page, abortController.signal, this.#logger).run();
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

class TdPageController {
  readonly #page: Page;
  readonly #abortSignal: AbortSignal;
  readonly #logger: Logger;

  constructor(page: Page, abortSignal: AbortSignal, logger: Logger) {
    this.#page = page;
    this.#abortSignal = abortSignal;
    this.#logger = logger;
  }

  async run(): Promise<void> {
    await this.#page.setViewport(null);
    await this.#page.goto('https://easyweb.td.com/');
    this.#closeCookieDialogWhenDisplayed();
    this.#logger.info('Enter login information into web page, if requested.');
    await this.#waitForPageSettled();
    await this.#clickStatementsAndDocumentsButton();
    await this.#waitForPageSettled();
    await this.#clickSelectAccountButton();
    await this.#listAccounts();
  }

  async #waitForPageSettled(): Promise<void> {
    await this.#page.waitForNavigation({
      timeout: 0,
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
    });
  }

  #closeCookieDialogWhenDisplayed(): void {
    const asyncFunction = async () => {
      this.#logger.info('Watching for cookie dialog... will close it if found');
      const elementHandle = await this.#page.waitForSelector('button.onetrust-close-btn-handler', {
        timeout: 0,
        signal: this.#abortSignal,
        visible: true,
      });
      this.#logger.info('Dismissing cookie dialog');
      await elementHandle!.click();
      this.#logger.info('Cookie dialog dismissed successfully');
    };
    asyncFunction().catch(error => {
      this.#logger.warn('Dismissing cookie dialog failed:', error);
    });
  }

  async #clickStatementsAndDocumentsButton(): Promise<void> {
    await this.#clickButtonWhenVisible('tduf-quick-link-item a span', 'Statements & Documents', {
      clickCausesNavigation: true,
    });
  }

  async #clickSelectAccountButton(): Promise<void> {
    await this.#clickButtonWhenVisible('span.mat-select-placeholder', 'Select an account');
  }

  async #listAccounts(): Promise<void> {
    const accountListSelector = 'span.tduf-dropdown-chip-option-detail-primary';

    this.#logger.info('Waiting for account list to display...');
    await this.#page.waitForSelector(accountListSelector, { timeout: 0, visible: true });

    const accountElementHandles: ElementHandle[] = await this.#page.$$(accountListSelector);
    this.#logger.info(`Found ${accountElementHandles.length} accounts`);
    for (let i = 0; i < accountElementHandles.length; i++) {
      const elementHandle = accountElementHandles[i]!;
      const elementText = await elementHandle.evaluate(textContent);
      this.#logger.info(`Account ${i + 1}: ${elementText}`);
    }
  }

  async #clickButtonWhenVisible(
    selector: string,
    text: string,
    options?: Readonly<Partial<ClickButtonWhenVisibleOptions>>,
  ): Promise<void> {
    const clickCausesNavigation = options?.clickCausesNavigation ?? false;

    let elementHandle = await this.#waitForElementBySelectorAndTextContent(selector, text);
    this.#logger.info(`Clicking button: "${text}"`);

    const promises: Promise<unknown>[] = [];
    if (clickCausesNavigation) {
      promises.push(this.#page.waitForNavigation());
    }
    promises.push(elementHandle.click());
    await Promise.all(promises);
  }

  async #waitForElementBySelectorAndTextContent(
    selector: string,
    textContent: string,
  ): Promise<ElementHandle> {
    this.#logger.info(`Waiting for element with text: "${textContent}"`);
    return this.#page.waitForFunction(
      elementBySelectorAndTextContent,
      { timeout: 0 },
      selector,
      textContent,
    );
  }
}

interface ClickButtonWhenVisibleOptions {
  clickCausesNavigation: boolean;
}

async function closePage(page: Page, logger: Logger): Promise<void> {
  logger.info('Closing TD page');
  try {
    await page.close();
  } catch (error: unknown) {
    logger.warn('Closing TD page failed:', error);
    return;
  }
  logger.info('Closed TD page');
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
