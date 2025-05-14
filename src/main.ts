import puppeteer from 'puppeteer';
import signale from 'signale';

import { TdPuppeteer } from './td/td.ts';

const logger = new signale.Signale({
  config: {
    displayScope: false,
    displayBadge: true,
    displayDate: true,
    displayTimestamp: true,
    displayFilename: false,
    displayLabel: false,
  },
});

const browser = await puppeteer.launch({ headless: false });
const tdPuppeteer = new TdPuppeteer(logger);
await tdPuppeteer.run(browser).finally(() => tdPuppeteer.close());
await browser.close();
