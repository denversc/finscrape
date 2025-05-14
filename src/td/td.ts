import { type PuppeteerHelper } from "../util/puppeteer_helper.ts";

export async function run(helper: PuppeteerHelper): Promise<void> {
  await helper.gotoUrl("https://easyweb.td.com/");
  helper.clickWhenAndIfVisibleBySelectorAsync({
    selector: "button.onetrust-close-btn-handler",
    description: `cookie preferences dialog "dismiss" button`,
  });
  await helper.waitForElementWithIdToBeVisible("username");
  await helper.typeTextIntoElementWithId({ elementId: "username", text: username });
  await helper.typeTextIntoElementWithId({ elementId: "uapPassword", text: "password" });
  await helper.clickButtonWithText("login");
}

const username = "denversc" as const;
