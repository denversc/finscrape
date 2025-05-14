import puppeteer from "puppeteer";

import * as td from "./td/td.ts";
import { getLogger } from "./util/logging.ts";
import { PuppeteerHelper } from "./util/puppeteer_helper.ts";

const leaveBrowserOpen = true;
const logger = getLogger();
const browser = await puppeteer.launch({ headless: false });
const puppeteerHelper = new PuppeteerHelper(logger);
await puppeteerHelper.start(browser);

if (leaveBrowserOpen) {
  td.run(puppeteerHelper)
    .catch(error => console.error(error))
    .finally(() => {
      logger.info("Not closing browser, by request");
    });
} else {
  await td.run(puppeteerHelper);
  await browser.close();
}
