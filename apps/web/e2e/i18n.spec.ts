import { test as base } from "@playwright/test";
import { createDeal, disconnectDb } from "./support/data";
import { expect, signIn, test, WEB_URL } from "./support/test";

test.afterAll(disconnectDb);

// next-intl renders a missing message as its dotted key path.
const RAW_KEY = /\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+\b/;

async function expectNoRawKeys(page: import("@playwright/test").Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(RAW_KEY);
  expect(text).not.toContain("MISSING_MESSAGE");
}

base("German is the default locale", async ({ page }) => {
  await page.goto(WEB_URL);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Finden Sie den perfekten Dienstleister",
    }),
  ).toBeVisible();
});

test("the language toggle switches between English and German", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome Back" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Zu Deutsch wechseln" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Willkommen zurück" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome Back" }),
  ).toBeVisible();
});

for (const locale of ["en", "de"] as const) {
  test(`public pages have no untranslated keys (${locale})`, async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([{ name: "locale", value: locale, url: WEB_URL }]);

    for (const path of [
      "/",
      "/categories",
      "/category/home-cleaning",
      "/find-providers",
      "/requests",
      "/how-it-works",
      "/become-provider",
      "/login",
      "/register",
      "/provider-onboarding",
      "/create-request",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoRawKeys(page);
    }
  });

  test(`signed-in pages have no untranslated keys (${locale})`, async ({
    page,
    browser,
  }) => {
    const { customer, providerUser, booking, serviceRequest } =
      await createDeal({
        label: `i18n-${locale}`,
        bookingStatus: "confirmed",
      });
    await page
      .context()
      .addCookies([{ name: "locale", value: locale, url: WEB_URL }]);
    await signIn(page, customer);

    for (const path of [
      "/customer-dashboard",
      "/my-requests",
      `/my-requests/${serviceRequest.id}`,
      "/bookings",
      `/bookings/${booking!.id}`,
      "/messages",
      "/notifications",
      "/settings",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoRawKeys(page);
    }

    const providerContext = await browser.newContext();
    const providerPage = await providerContext.newPage();
    await providerContext.addCookies([
      { name: "locale", value: locale, url: WEB_URL },
    ]);
    await signIn(providerPage, providerUser);
    for (const path of [
      "/dashboard",
      "/dashboard/listings",
      "/dashboard/offers",
      "/dashboard/orders",
      "/dashboard/calendar",
      "/dashboard/reviews",
      "/dashboard/profile",
      "/dashboard/settings",
    ]) {
      await providerPage.goto(path);
      await providerPage.waitForLoadState("networkidle");
      await expectNoRawKeys(providerPage);
    }
    await providerContext.close();
  });
}
