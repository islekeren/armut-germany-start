import { type Page } from "@playwright/test";
import {
  createBooking,
  createDeal,
  createProvider,
  createRequest,
  createUser,
  db,
  disconnectDb,
  PASSWORD,
  uniqueEmail,
} from "./support/data";
import {
  API_URL,
  expect,
  setEnglishLocale,
  signIn,
  test,
} from "./support/test";

test.afterAll(disconnectDb);

async function fillProfile(page: Page, email: string, existing = false) {
  await page
    .getByRole("button", { name: "Cleaning & Home Care", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Home Cleaning", exact: true })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("form input[type=text]").nth(0).fill("Pat");
  await page.locator("form input[type=text]").nth(1).fill("Recovery");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("form input[type=text]").nth(0).fill("Torstrasse 1");
  await page.locator("form input[type=text]").nth(1).fill("10115");
  await page.locator("form input[type=text]").nth(2).fill("Berlin");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("form input[type=tel]").fill("+49301234567");
  if (!existing) await page.locator("form input[type=email]").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("form input[type=text]").nth(0).fill("Recovery Cleaners");
  await page.locator("form textarea").fill("Reliable cleaning in Berlin.");
  if (!existing) {
    await page.locator("form input[type=password]").nth(0).fill(PASSWORD);
    await page.locator("form input[type=password]").nth(1).fill(PASSWORD);
    await page.getByRole("checkbox", { name: /I agree to/ }).check();
  }
}

test("reschedule → provider approval → completion → review @smoke", async ({
  page,
  browser,
  loginAs,
}) => {
  const deal = await createDeal({
    label: "recover-booking",
    bookingStatus: "confirmed",
  });
  await loginAs(deal.customer);
  await page.goto(`/bookings/${deal.booking!.id}`);
  const date = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await page.locator('input[type="datetime-local"]').fill(`${date}T14:30`);
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db().booking.findUniqueOrThrow({
            where: { id: deal.booking!.id },
          })
        ).status,
    )
    .toBe("pending");
  const context = await browser.newContext();
  try {
    const providerPage = await context.newPage();
    await setEnglishLocale(providerPage);
    await signIn(providerPage, deal.providerUser);
    await providerPage.goto("/dashboard/orders");
    await providerPage
      .getByRole("button", { name: new RegExp(deal.serviceRequest.title) })
      .click();
    await expect(
      providerPage.getByRole("button", { name: "Mark as Completed" }),
    ).toHaveCount(0);
    await providerPage
      .getByRole("button", { name: "Confirm Booking", exact: true })
      .click();
    await expect(
      providerPage.getByRole("button", { name: "Mark as Completed" }),
    ).toBeVisible();
    await providerPage
      .getByRole("button", { name: "Mark as Completed" })
      .click();
    await expect(
      providerPage.getByText(
        "Completion request sent to customer. Waiting for approval.",
      ),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Confirm job is completed" })
      .click();
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page
      .getByPlaceholder("Tell others what went well and what could be better.")
      .fill("Rescheduled and completed successfully.");
    await page.getByRole("button", { name: "Submit Review" }).click();
    await expect(page.getByText("Review submitted successfully")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("accepted offer waits for booking then links to the actual order @smoke", async ({
  page,
  loginAs,
}) => {
  const deal = await createDeal({
    label: "await-booking",
    quoteStatus: "accepted",
    requestStatus: "in_progress",
  });
  await loginAs(deal.providerUser);
  await page.goto("/dashboard/offers");
  await expect(page.getByText(deal.serviceRequest.title)).toBeVisible();
  await expect(
    page.getByText("Waiting for the customer to create a booking"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View Order" })).toHaveCount(0);
  expect(await db().booking.count({ where: { quoteId: deal.quote.id } })).toBe(
    0,
  );
  const booking = await createBooking({
    quoteId: deal.quote.id,
    customerId: deal.customer.id,
    providerId: deal.provider.id,
    status: "pending",
  });
  await page.reload();
  await expect(
    page.getByText("Waiting for the customer to create a booking"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "View Order" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard/orders\\?booking=${booking.id}`),
  );
  await expect(
    page.getByRole("button", { name: "Confirm Booking", exact: true }),
  ).toBeVisible();
});

for (const status of [
  "pending",
  "confirmed",
  "in_progress",
  "completion_pending",
] as const) {
  test(`active ${status} booking appears in offers and orders`, async ({
    page,
    loginAs,
  }) => {
    const deal = await createDeal({
      label: `active-${status}`,
      bookingStatus: status,
    });
    await loginAs(deal.providerUser);
    await page.goto("/dashboard/offers");
    await page.getByRole("link", { name: "View Order" }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(deal.serviceRequest.title) }),
    ).toBeVisible();
    await expect(
      page.getByText("Waiting for the customer to create a booking"),
    ).toHaveCount(0);
  });
}

for (const failure of ["validation", "network"] as const) {
  test(`onboarding retries after ${failure} without creating another account @smoke`, async ({
    page,
  }) => {
    const email = uniqueEmail(`onboard-${failure}`);
    let registrations = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/auth/register")) registrations++;
    });
    await page.route("**/api/providers", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      if (failure === "network") await route.abort("failed");
      else
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Invalid provider description" }),
        });
    });
    await page.goto("/provider-onboarding");
    await fillProfile(page, email);
    await page.getByRole("button", { name: "Finish onboarding" }).click();
    await expect(
      page.getByRole("button", { name: "Finish onboarding" }),
    ).toBeEnabled();
    await expect
      .poll(async () => db().user.count({ where: { email } }))
      .toBe(1);
    await expect(page).toHaveURL(/provider-onboarding/);
    await page.unroute("**/api/providers");
    await page.getByRole("button", { name: "Finish onboarding" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(registrations).toBe(1);
    const user = await db().user.findUniqueOrThrow({ where: { email } });
    expect(await db().provider.count({ where: { userId: user.id } })).toBe(1);
  });
}

test("login resumes onboarding for an account without a provider profile", async ({
  page,
}) => {
  const user = await createUser({
    label: "incomplete-provider",
    userType: "provider",
  });
  await page.goto("/login?redirect=/dashboard");
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/provider-onboarding$/);
  await fillProfile(page, user.email, true);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Finish onboarding" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await db().user.count({ where: { email: user.email } })).toBe(1);
});

test("a lost successful profile response can be retried without duplicate services", async ({
  page,
}) => {
  const email = uniqueEmail("lost-profile-response");
  await page.route("**/api/providers", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    await route.abort("failed");
  });
  await page.goto("/provider-onboarding");
  await fillProfile(page, email);
  await page.getByRole("button", { name: "Finish onboarding" }).click();
  await expect.poll(async () => db().user.count({ where: { email } })).toBe(1);
  const user = await db().user.findUniqueOrThrow({ where: { email } });
  await expect
    .poll(async () => db().provider.count({ where: { userId: user.id } }))
    .toBe(1);
  await page.unroute("**/api/providers");
  // Re-send the same creation request: the server returns the existing profile.
  const token = await page.evaluate(() =>
    localStorage.getItem("armut_access_token"),
  );
  const retry = await page.request.post(`${API_URL}/api/providers`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      description: "Reliable cleaning in Berlin.",
      serviceAreaRadius: 25,
      serviceAreaLat: 0,
      serviceAreaLng: 0,
      categories: ["home-cleaning"],
    },
  });
  expect(retry.ok(), await retry.text()).toBeTruthy();
  const provider = await db().provider.findUniqueOrThrow({
    where: { userId: user.id },
  });
  expect(
    await db().providerProfile.count({ where: { providerId: provider.id } }),
  ).toBe(1);
  expect(await db().service.count({ where: { providerId: provider.id } })).toBe(
    1,
  );
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const inactive of [false, true]) {
  test(`listings explains ${inactive ? "inactive" : "missing"} services with a working next step`, async ({
    page,
    loginAs,
  }) => {
    const { user, provider } = await createProvider({
      label: "no-active-services",
      categories: inactive ? ["home-cleaning"] : [],
    });
    if (inactive)
      await db().service.updateMany({
        where: { providerId: provider.id },
        data: { isActive: false },
      });
    await loginAs(user);
    await page.goto("/dashboard/listings");
    await expect(page.getByText("No active services")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage Services" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "View Profile" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Profile", exact: true }),
    ).toBeVisible();
  });
}

test("listings distinguishes no eligible requests from empty filters", async ({
  page,
  loginAs,
}) => {
  const { user, provider } = await createProvider({
    label: "empty-listings",
    categories: ["home-cleaning"],
  });
  // Use a tiny radius at an isolated location so unrelated parallel fixtures cannot match.
  await db().provider.update({
    where: { id: provider.id },
    data: {
      serviceAreaLat: 48.137,
      serviceAreaLng: 11.575,
      serviceAreaRadius: 1,
    },
  });
  await loginAs(user);
  await page.goto("/dashboard/listings");
  await expect(page.getByText("No matching requests right now")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh Listings" }),
  ).toBeVisible();
  const customer = await createUser({ label: "eligible-empty" });
  const request = await createRequest({ customerId: customer.id });
  await db().serviceRequest.update({
    where: { id: request.id },
    data: { lat: 48.137, lng: 11.575 },
  });
  await page.getByRole("button", { name: "Refresh Listings" }).click();
  await expect(
    page.getByRole("heading", { name: request.title }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Title, description, location...")
    .fill("no-such-request-unique");
  await expect(page.getByText("No listings match your filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear Filters" }).click();
  await expect(
    page.getByRole("heading", { name: request.title }),
  ).toBeVisible();
});

test("a profile-check network error can be retried without treating the profile as missing", async ({
  page,
  loginAs,
}) => {
  const { user } = await createProvider({ label: "profile-check-retry" });
  await loginAs(user);
  await page.route("**/api/providers/me", (route) => route.abort("failed"));
  await page.goto("/provider-onboarding");
  await expect(
    page.getByText(
      "Your provider profile could not be checked. Please try again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/providers/me");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("wrong-category and distant requests are hidden and denied by direct ID", async ({
  page,
  loginAs,
}) => {
  const customer = await createUser({ label: "scope-browser-customer" });
  const { user } = await createProvider({ label: "scope-browser-provider" });
  const eligible = await createRequest({ customerId: customer.id });
  const wrongCategory = await createRequest({
    customerId: customer.id,
    categorySlug: "office-cleaning",
  });
  const distant = await createRequest({ customerId: customer.id });
  await db().serviceRequest.update({
    where: { id: distant.id },
    data: { lat: 48.137, lng: 11.575 },
  });
  const { accessToken } = await loginAs(user);
  await page.goto("/dashboard/listings");
  await expect(
    page.getByRole("heading", { name: eligible.title }),
  ).toBeVisible();
  for (const request of [wrongCategory, distant]) {
    await expect(
      page.getByRole("heading", { name: request.title }),
    ).toHaveCount(0);
    const response = await page.request.get(
      `${API_URL}/api/providers/me/requests/${request.id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(response.status()).toBe(404);
  }
});
