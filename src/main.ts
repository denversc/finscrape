import puppeteer from 'puppeteer';
import signale from 'signale';

import {
  elementBySelectorAndTextContent,
} from './browser/wait_for_functions.ts';

const logger = new signale.Signale({
  config: {
    displayScope: false,
    displayBadge: true,
    displayDate: true,
    displayTimestamp: true,
    displayFilename: false,
    displayLabel: false
  }
});

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.setViewport(null);
await page.goto('https://easyweb.td.com/');

page.waitForSelector("button.onetrust-close-btn-handler", {timeout: 0}).then(elementHandle => {
  logger.info("Dismissing cookie dialog");
  elementHandle?.click()
}).catch(error => logger.warn("Dismissing cookie dialog failed:", error));

logger.await("Waiting for user to log in");
const statementsButton = await page.waitForFunction(
  elementBySelectorAndTextContent,
  {timeout: 0},
  "tduf-quick-link-item a span",
  "Statements & Documents",
);
logger.await(`Clicking statements button`);
await statementsButton.click();

const selectAnAccountButton = await page.waitForFunction(
  elementBySelectorAndTextContent,
    {timeout: 0},
    "span.mat-select-placeholder",
    "Select an account",
);

const accounts: puppeteer.JSHandle = await page.waitForFunction(async selectAnAccountButton => {
  console.log(`Clicking select an account button`);
  await selectAnAccountButton.click();
  const spans = document.querySelectorAll("span.tduf-dropdown-chip-option-detail-primary");
  if (spans.length > 0) {
    return spans;
  }
}, {timeout: 0}, selectAnAccountButton);

const numAccounts: number = await accounts.evaluate(elementList => elementList.length);
logger.info(`Found accounts: ${numAccounts}`)
const accountNames: string[] = [];
for (let i=0; i<numAccounts; i++) {
  const accountName: string = await accounts.evaluate((elementList, i) => elementList[i].innerText, i);
  logger.info(`Account #${i}: ${accountName}`);
  accountNames.push(accountName);
}

logger.info(`Clicking account: ${accountNames[0]}`);
accounts.evaluate(elementList => {elementList[0].click()});
