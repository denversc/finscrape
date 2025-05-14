import type { Browser, ElementHandle, Page } from 'puppeteer';
import { elementBySelectorAndTextContent } from '../browser/wait_for_functions.ts';
import { getTextContent } from '../browser/evaluate_functions.ts';

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
    await this.#clickSelectAccountButton();

    const accountNames = await this.#getAccountNamesFromAccountList(await this.#getAccountElementsFromAccountList());
    this.#logger.info(`Found ${accountNames.length} accounts:`);
    accountNames.forEach((accountName, index) => {
      this.#logger.info(`Account #${index+1}: "${accountName}"`);
    });

    for (let accountIndex=0; accountIndex<accountNames.length; accountIndex++) {
      const accountName = accountNames[accountIndex]!;
      await this.#clickMyAccountsButton();
      await this.#clickSelectAccountButton();
      await this.#selectAccountFromAccountList(accountName);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
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
    this.#logger.info(`Clicking "Select Account" button`);
    const selectAccountButtonSelector = 'div.uf-dropdown-chip-trigger';
    await this.#page.waitForSelector(selectAccountButtonSelector, {timeout: 0, visible:true});
    const buttons = await this.#page.$$(selectAccountButtonSelector);
    if (!buttons || typeof buttons !== "object" || buttons.length !== 3) {
      throw new Error(`unable to find "Select Account" button: buttons=${buttons}`);
    }
    await buttons[0]!.click();
  }

  async #clickMyAccountsButton(): Promise<void> {
    await this.#clickButtonWhenVisible('tduf-top-nav-link', 'My Accounts', {
      clickCausesNavigation: true,
    });
  }

  async #getAccountElementsFromAccountList(): Promise<ElementHandle[]> {
    this.#logger.info('Waiting for account list to display...');
    const listBox = await this.#page.waitForSelector("#matselect-mat-select-0-panel");
    return listBox!.$$(".tduf-dropdown-chip-option-detail-primary");
  }

  async #getAccountNamesFromAccountList(accountElements: ElementHandle[]): Promise<string[]> {
    const accountNames: string[] = [];
    for (const accountElement of accountElements) {
      const elementText = await accountElement.evaluate(getTextContent);
      accountNames.push(`${elementText}`);
    }
    return accountNames;
  }

  async #selectAccountFromAccountList(accountName: string): Promise<void> {
    this.#logger.info(`Selecting account from account list: "${accountName}"`);

    const accountElements = await this.#getAccountElementsFromAccountList();
    const accountNames = await this.#getAccountNamesFromAccountList(accountElements);
    const accountIndex = accountNames.indexOf(accountName);
    if (accountIndex < 0) {
      throw new Error(`could not find account element for account with name: "${accountName}" ` +
      `(got ${accountNames.length} names: ${accountNames.map(name => `"${name}"`).join(", ")}) ` +
      "[rpxr6stvh2]");
    }

    await accountElements[accountIndex]!.click();
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
