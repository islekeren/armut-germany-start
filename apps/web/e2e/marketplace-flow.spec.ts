import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const BASE_URL = "http://localhost:3000";

async function applyEnglishLocale(page: Page) {
  await page.context().addCookies([
    {
      name: "locale",
      value: "en",
      url: BASE_URL,
    },
  ]);
}

test.beforeEach(async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/categories`);
  expect(response.ok()).toBeTruthy();
});

async function login(
  page: Page,
  input: { email: string; password: string; redirect: string },
) {
  await applyEnglishLocale(page);
  await page.goto(`/login?redirect=${encodeURIComponent(input.redirect)}`);
  await page.locator('input[type="email"]').fill(input.email);
  await page.locator('input[type="password"]').fill(input.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`**${input.redirect}`);
}

test("customer can log in and create a request", async ({ page, request }) => {
  const email = `customer.${Date.now()}@example.com`;
  const password = "Password123!";

  const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      firstName: "Casey",
      lastName: "Customer",
      userType: "customer",
      gdprConsent: true,
    },
  });
  expect(registerResponse.ok()).toBeTruthy();

  await login(page, {
    email,
    password,
    redirect: "/create-request",
  });
  await expect(
    page.getByRole("heading", { name: "What do you need?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cleaning & Home Care" }).click();
  await page.getByRole("button", { name: "Home Cleaning" }).click();

  await page
    .getByPlaceholder("e.g., Deep cleaning for 3-room apartment")
    .fill("Post-renovation deep cleaning");
  await page
    .getByPlaceholder(
      "Describe your request in detail. What exactly do you need? Are there any special requirements?",
    )
    .fill("Please deep clean a 3-room apartment after renovation work is finished.");
  await page.getByPlaceholder("e.g., 10115").fill("10115");
  await page.getByPlaceholder("e.g., Berlin").fill("Berlin");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Review your request" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit Request" }).click();

  await page.waitForURL("**/my-requests");
  await expect(page).toHaveURL(/\/my-requests$/);
});

test("provider can view listings and send an offer", async ({ page }) => {
  await login(page, {
    email: "provider@test.com",
    password: "12345678",
    redirect: "/dashboard/listings",
  });

  await expect(
    page.getByRole("heading", { name: "Open Listings" }),
  ).toBeVisible();

  await page.getByRole("heading", { name: "Have apartment cleaned (80sqm)" }).click();
  await page.locator('input[placeholder="100"]').fill("145");
  await page.locator('input[type="date"]').fill("2026-05-01");
  await page
    .getByPlaceholder("Describe your offer and what's included...")
    .fill("I can complete this cleaning in one visit and bring all materials.");
  await page.getByRole("button", { name: "Send Offer" }).click();

  await expect(page.getByText("Offer sent successfully")).toBeVisible();
});

test("customer can reach notifications and bookings pages", async ({ page }) => {
  await login(page, {
    email: "customer@test.com",
    password: "12345678",
    redirect: "/notifications",
  });

  await expect(
    page.getByRole("heading", { name: "Notifications" }),
  ).toBeVisible();
  await expect(page.getByText("New offer received")).toBeVisible();

  await page.goto("/bookings");
  await expect(
    page.getByRole("heading", { name: "My Bookings" }),
  ).toBeVisible();
});
