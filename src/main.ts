import puppeteer from "puppeteer";
import yargs from 'yargs';
import { hideBin } from "yargs/helpers";

import * as td from "./td/td.ts";
import { getLogger } from "./util/logging.ts";
import { PuppeteerHelper } from "./util/puppeteer_helper.ts";

const yargsResult = await yargs(hideBin(process.argv))
  .usage('$0 [options]')
  .option('username', {
    string: true,
    description: 'The username for logging into the web site.',
  })
  .option('encrypted-password', {
    string: true,
    description: 'The (encrypted) password for logging into the web site.',
  })
  .option('leave-browser-open', {
    boolean: true,
    description: 'Leave the browser opened instead of closing it at the end ' +
    '(useful for debugging)',
  })
  .showHelpOnFail(true)
  .strict()
  .parse();

const {username, password, leaveBrowserOpen} = yargsResult;

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
