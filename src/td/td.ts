import type { Page } from 'puppeteer';

import { type Logger } from '../util/logging.ts';
import {
  BasePuppeteerHelperFunc,
  PuppeteerHelper,
  type PuppeteerHelperFunction,
} from '../util/puppeteer_helper.ts';

const START_URL = 'https://easyweb.td.com/' as const;

export class TdPuppeteer extends PuppeteerHelper {
  constructor(logger: Logger) {
    super(START_URL, puppeteerHelperFunction, logger);
  }
}

const puppeteerHelperFunction: PuppeteerHelperFunction = (
  page: Page,
  abortSignal: AbortSignal,
  logger: Logger,
) => new TdPageController(page, abortSignal, logger).run();

class TdPageController extends BasePuppeteerHelperFunc {
  constructor(page: Page, abortSignal: AbortSignal, logger: Logger) {
    super(page, abortSignal, logger);
  }

  async run(): Promise<void> {
    this.#closeCookieDialogWhenDisplayed();
  }

  #closeCookieDialogWhenDisplayed(): void {
    this.clickWhenAndIfVisibleBySelectorAsync(
      'button.onetrust-close-btn-handler',
      `cookie preferences dialog "dismiss" button`,
    );
  }
}
