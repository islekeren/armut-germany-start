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

  for (const role of ["customer", "provider"] as const) {
    for (const deepLink of [false, true]) {
      test(`${role} mobile list survives repeated polls${deepLink ? " with deep link" : ""} @smoke`, async ({
        page,
        loginAs,
      }) => {
        const { customer, providerUser, serviceRequest } = await createDeal({
          label: `mobile-${role}`,
        });
        const first = await createConversation({
          participantIds: [customer.id, providerUser.id],
          requestId: serviceRequest.id,
        });
        const second = await createConversation({
          participantIds: [customer.id, providerUser.id],
        });
        await db().conversation.update({
          where: { id: second.id },
          data: { lastMessageAt: new Date(Date.now() + 1000) },
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await loginAs(role === "customer" ? customer : providerUser);
        const path = role === "customer" ? "/messages" : "/dashboard/messages";
        const initialMessages = page.waitForResponse(r => r.url().includes(`/api/messages/conversations/${deepLink ? first.id : second.id}/messages`));
        await page.goto(
          `${path}${deepLink ? `?conversation=${first.id}` : ""}`,
        );
        await initialMessages;
        const back = page.getByRole("button", {
          name: "Back to conversations",
        });
        await expect(back).toBeVisible();
        await page.clock.install();
        await back.click();
        for (let poll = 0; poll < 2; poll++) {
          const refreshed = page.waitForResponse(
            (r) =>
              r.url().endsWith("/api/messages/conversations") &&
              r.request().method() === "GET",
          );
          await page.clock.runFor(10_000);
          await refreshed;
          await expect(back).toBeHidden();
          await expect(page.locator("aside").getByRole("button")).toHaveCount(
            2,
          );
          await expect(page.locator("aside")).toBeVisible();
        }
        const target = page.waitForResponse((r) =>
          r.url().includes(`/api/messages/conversations/${second.id}/messages`),
        );
        // The second conversation is newest and therefore first in the list.
        await page.locator("aside").getByRole("button").first().click();
        await target;
        await expect(back).toBeVisible();
        const selectedMessages = page.waitForResponse(r => r.url().includes(`/api/messages/conversations/${second.id}/messages`));
        const refreshed = page.waitForResponse((r) =>
          r.url().endsWith("/api/messages/conversations"),
        );
        await page.clock.runFor(10_000);
        await refreshed;
        await selectedMessages;
        await expect(back).toBeVisible();
      });
    }
  }

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
