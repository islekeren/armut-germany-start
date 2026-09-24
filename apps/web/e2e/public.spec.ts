import {
  createProvider,
  createRequest,
  createUser,
  disconnectDb,
} from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

test.describe("public pages", () => {
  test("home page shows the hero, categories, and how it works @smoke", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Find the Perfect Service Provider",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Categories" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How It Works" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /Electrician/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/category\/electrician$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Electrician" }),
    ).toBeVisible();
  });

  test("categories page lists branches that link to their category page", async ({
    page,
  }) => {
    await page.goto("/categories");

    await expect(
      page.getByRole("heading", { level: 1, name: "Service Categories" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Electrician" }),
    ).toBeVisible();
    await page.getByRole("heading", { name: "Electrician" }).click();
    await expect(page).toHaveURL(/\/category\/electrician$/);
  });

  test("category page lists approved providers only", async ({ page }) => {
    const { provider: approved } = await createProvider({
      label: "cat-approved",
      companyName: `Approved Cleaners ${Date.now()}`,
      topRated: true,
    });
    const { provider: pending } = await createProvider({
      label: "cat-pending",
      companyName: `Pending Cleaners ${Date.now()}`,
      isApproved: false,
      topRated: true,
    });

    await page.goto("/category/home-cleaning");

    await expect(
      page.getByRole("heading", { name: approved.companyName! }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: pending.companyName! }),
    ).toHaveCount(0);
  });

  test("find providers lists providers and filters by postcode", async ({
    page,
  }) => {
    const { provider } = await createProvider({
      label: "find",
      companyName: `Findable Co ${Date.now()}`,
      topRated: true,
    });

    await page.goto("/find-providers");
    await expect(
      page.getByRole("heading", { level: 1, name: "Find Providers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: provider.companyName! }),
    ).toBeVisible();

    await page.getByPlaceholder("e.g. 10115").fill("80331");
    await page.getByPlaceholder("e.g. 10115").press("Enter");
    await expect(
      page.getByRole("heading", { name: provider.companyName! }),
    ).toHaveCount(0);
  });

  test("provider profile shows company, services, and a request CTA", async ({
    page,
  }) => {
    const { provider } = await createProvider({
      label: "profile",
      companyName: `Profile Co ${Date.now()}`,
    });

    await page.goto(`/providers/${provider.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: provider.companyName! }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Home Cleaning" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Request" }),
    ).toBeVisible();
  });

  test("open requests board shows open requests only", async ({ page }) => {
    const customer = await createUser({ label: "board" });
    const open = await createRequest({
      customerId: customer.id,
      title: `Open board job ${Date.now()}`,
    });
    const taken = await createRequest({
      customerId: customer.id,
      title: `Taken board job ${Date.now()}`,
      status: "in_progress",
    });

    await page.goto("/requests");

    await expect(
      page.getByRole("heading", { level: 1, name: "Open Requests" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: open.title })).toBeVisible();
    await expect(page.getByRole("heading", { name: taken.title })).toHaveCount(
      0,
    );
    // The street address is private to the customer.
    await expect(page.getByText("Torstrasse 1")).toHaveCount(0);
  });

  test("static pages render", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(
      page.getByRole("heading", { level: 1, name: "How Elf Germany Works" }),
    ).toBeVisible();

    await page.goto("/become-provider");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Become a Service Provider on Elf",
      }),
    ).toBeVisible();
  });

  test("unknown pages return the 404 page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "This page could not be found." }),
    ).toBeVisible();
  });
});
