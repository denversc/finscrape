import puppeteer from "puppeteer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import * as td from "./td/td.ts";
import { AppData } from "./util/app_data.ts";
import { getLogger } from "./util/logging.ts";
import { PuppeteerHelper } from "./util/puppeteer_helper.ts";

const yargsResult = await yargs(hideBin(process.argv))
  .usage("$0 [options]")
  .option("app-data-file", {
    alias: "f",
    string: true,
    demandOption: true,
    description: "The path of the file containing app information, like login credentials.",
  })
  .option("leave-browser-open", {
    boolean: true,
    description:
      "Leave the browser opened instead of closing it at the end " + "(useful for debugging)",
  })
  .showHelpOnFail(true)
  .strict()
  .parse();

const { appDataFile, leaveBrowserOpen } = yargsResult;

const logger = getLogger();
const browser = await puppeteer.launch({ headless: false });
const appData = new AppData(appDataFile);
const puppeteerHelper = new PuppeteerHelper(logger);
await puppeteerHelper.start(browser);

appData.open();
try {
  if (leaveBrowserOpen) {
    td.run(puppeteerHelper, appData)
      .catch(error => console.error(error))
      .finally(() => {
        logger.info("Not closing browser, by request");
      });
  } else {
    await td.run(puppeteerHelper, appData);
    await browser.close();
    await puppeteerHelper.close();
  }
} finally {
  appData.close();
}
