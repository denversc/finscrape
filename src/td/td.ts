import { type AppData } from "../util/app_data.ts";
import { type UserAsker } from "../util/ask_user.ts";
import { getTextContent } from "../util/browser/evaluate_functions.ts";
import { type PuppeteerHelper } from "../util/puppeteer_helper.ts";

export async function run(
  helper: PuppeteerHelper,
  appData: AppData,
  userAsker: UserAsker,
): Promise<void> {
  const logger = helper.logger;
  await login(helper, appData, userAsker);
  await goToStatementsAndDocuments(helper);
  await openSelectAccountListBox(helper);

  const accountNames = await getAccountNames(helper);
  logger.info(`Found ${accountNames.length} accounts:`);
  accountNames.forEach((accountName, index) =>
    logger.info(`  Account #${index + 1}: "${accountName}"`),
  );

  let accountNameIndex = 0;
  while (accountNameIndex < accountNames.length) {
    const accountName = accountNames[accountNameIndex]!;
    logger.info(`Downloading statements for account: ${accountName}`);
    accountNameIndex++;
    if (accountNameIndex > 1) {
      await helper.clickElementWithText({
        selector: ".tduf-dropdown-chip-option-detail-primary",
        text: accountNames[accountNameIndex - 1]!,
        waitForVisible: true,
        waitForNetworkIdle: true,
      });
    }
    await helper.clickElementWithText({
      selector: ".tduf-dropdown-chip-option-detail-primary",
      text: accountName,
      waitForVisible: true,
      waitForNetworkIdle: true,
    });

    await helper.page.waitForSelector("tbody", { timeout: 0 });
    const rows = await helper.page.$$("tbody > tr.mat-row > td.mat-cell:first-child");

    for (const row of rows) {
      const date = (await row.evaluate(getTextContent))?.trim();
      if (!date) {
        continue;
      }
      logger.info(`Downloading statement for date: ${date}`);
      await row.scrollIntoView();
      await row.click();

      const downloadButtonSelector = `button[aria-label="Download"]`;
      await helper.page.waitForSelector(downloadButtonSelector, { timeout: 0, visible: true });
      await new Promise(resolve => setTimeout(resolve, 500));
      await helper.page.click(downloadButtonSelector);
      break;
    }

    break;
  }
}

interface LoginCredentials {
  username: string;
  password: string;
}

async function getLoginCredentials(
  appData: AppData,
  userAsker: UserAsker,
): Promise<LoginCredentials> {
  const credentialsList = await appData.getCredentialsForDomain("td");
  if (credentialsList.length > 0) {
    return credentialsList[0] as LoginCredentials;
  }

  const inputtedUsername = await userAsker.ask({
    title: "TD Username",
    prompt: "Enter username for TD:",
  });

  const inputtedPassword = await userAsker.ask({
    title: "TD Password",
    prompt: "Enter password for TD:",
    sensitive: true,
  });

  const credentials = {
    username: inputtedUsername.trim(),
    password: inputtedPassword.trim(),
  } satisfies LoginCredentials;

  appData.insertCredentialsForDomain("td", credentials);
  return credentials;
}

async function login(
  helper: PuppeteerHelper,
  appData: AppData,
  userAsker: UserAsker,
): Promise<void> {
  await helper.gotoUrl("https://easyweb.td.com/");
  helper.clickWhenAndIfVisibleBySelectorAsync({
    selector: "button.onetrust-close-btn-handler",
    description: `cookie preferences dialog "dismiss" button`,
  });

  const { username, password } = await getLoginCredentials(appData, userAsker);

  await helper.waitForElementWithIdToBeVisible("username");
  await helper.typeTextIntoElementWithId({ elementId: "username", text: username });
  await helper.typeTextIntoElementWithId({
    elementId: "uapPassword",
    text: password,
    sensitive: true,
  });
  await helper.clickButtonWithText("login", { waitForNavigation: true });
}

async function goToStatementsAndDocuments(helper: PuppeteerHelper): Promise<void> {
  await helper.clickButtonWithSelector("div.uf-trigger-icon");
  await helper.clickElementWithText({
    selector: "tduf-top-nav-menu-option",
    text: "Statements & Documents",
    waitForNavigation: true,
    waitForVisible: true,
  });
}

async function openSelectAccountListBox(helper: PuppeteerHelper): Promise<void> {
  await helper.clickElementWithText({
    selector: "span.mat-select-placeholder",
    text: "Select an Account",
    waitForVisible: true,
  });
}

async function getAccountNames(helper: PuppeteerHelper): Promise<string[]> {
  const elements = await helper.getElementsAndTextContentMatchingSelector(
    ".tduf-dropdown-chip-option-detail-primary",
  );
  const accountNames: string[] = [];
  for (const elementInfo of elements) {
    accountNames.push(elementInfo.textContent.trim());
  }
  return accountNames;
}
