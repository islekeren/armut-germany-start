import {
  createConversation,
  createDeal,
  db,
  disconnectDb,
} from "./support/data";
import { expect, signIn, test, setEnglishLocale } from "./support/test";

test.afterAll(disconnectDb);

test.describe("messaging", () => {
  test("customer and provider exchange messages @smoke", async ({
    browser,
    page,
    loginAs,
  }) => {
    const { customer, providerUser, serviceRequest } = await createDeal({
      label: "chat",
    });
    const conversation = await createConversation({
      participantIds: [customer.id, providerUser.id],
      requestId: serviceRequest.id,
    });
    const hello = `Hello from the customer ${Date.now()}`;
    const reply = `Reply from the provider ${Date.now()}`;

    // Customer side.
    await loginAs(customer);
    await page.goto(`/messages?conversation=${conversation.id}`);
    const customerBox = page
      .getByPlaceholder("Write a message...")
      .locator("visible=true");
    await customerBox.fill(hello);
    await page
      .getByRole("button", { name: "Send" })
      .locator("visible=true")
      .click();
    await expect(
      page.getByText(hello).locator("visible=true").first(),
    ).toBeVisible();

    // Provider side, in a separate browser context.
    const providerContext = await browser.newContext();
    const providerPage = await providerContext.newPage();
    await setEnglishLocale(providerPage);
    await signIn(providerPage, providerUser);

    await providerPage.goto(
      `/dashboard/messages?conversation=${conversation.id}`,
    );
    await expect(
      providerPage.getByText(hello).locator("visible=true").first(),
    ).toBeVisible();
    await providerPage
      .getByPlaceholder("Write a message...")
      .locator("visible=true")
      .fill(reply);
    await providerPage
      .getByRole("button", { name: "Send" })
      .locator("visible=true")
      .click();
    await expect(
      providerPage.getByText(reply).locator("visible=true").first(),
    ).toBeVisible();
    await providerContext.close();

    // The UI polls rather than using sockets, so the reply shows up without
    // a reload within the polling interval.
    await expect(
      page.getByText(reply).locator("visible=true").first(),
    ).toBeVisible({
      timeout: 30_000,
    });
    expect(
      await db().message.count({ where: { conversationId: conversation.id } }),
    ).toBe(2);
  });

  test("starting a conversation from a quote opens the workspace", async ({
    page,
    loginAs,
  }) => {
    const { customer, provider, serviceRequest } = await createDeal({
      label: "chat-start",
    });
    await loginAs(customer);

    await page.goto(`/my-requests/${serviceRequest.id}`);
    await page
      .locator("div", {
        has: page.getByRole("heading", { name: provider.companyName! }),
      })
      .getByRole("button", { name: "Send Message" })
      .last()
      .click();

    await expect(page).toHaveURL(/\/messages\?conversation=[0-9a-f-]{36}/);
    await expect(
      page.getByRole("heading", { name: "Pat Provider" }).first(),
    ).toBeVisible();
  });
});
