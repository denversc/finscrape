import puppeteer from 'puppeteer';

import { TdPuppeteer } from './td/td.ts';
import { getLogger } from './util/logging.ts';

const leaveBrowserOpen = true;
const logger = getLogger();

const browser = await puppeteer.launch({ headless: false });
const td = new TdPuppeteer(logger);

if (leaveBrowserOpen) {
  td.run(browser)
    .catch(error => console.error(error))
    .finally(() => {
      logger.info('Not closing browser, by request');
    });
} else {
  await td.run(browser);
  await browser.close();
}
