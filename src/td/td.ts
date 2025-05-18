import { type PuppeteerHelper } from "../util/puppeteer_helper.ts";

export async function run(
  helper: PuppeteerHelper,
  username: string,
  encryptedPasswordFile: string,
): Promise<void> {
  await helper.gotoUrl("https://easyweb.td.com/");
  helper.clickWhenAndIfVisibleBySelectorAsync({
    selector: "button.onetrust-close-btn-handler",
    description: `cookie preferences dialog "dismiss" button`,
  });
  await helper.waitForElementWithIdToBeVisible("username");
  await helper.typeTextIntoElementWithId({ elementId: "username", text: username });
  await helper.typeTextDecryptedFromFileIntoElementWithId({
    elementId: "uapPassword",
    file: encryptedPasswordFile,
  });
  await helper.clickButtonWithText("login", { waitForNavigation: true });
  await helper.clickButtonWithSelector("div.uf-trigger-icon");
  await helper.clickElementWithText({
    tagName: "tduf-top-nav-menu-option",
    text: "Statements & Documents",
    waitForNavigation: true,
    waitForVisible: true,
  });
}
