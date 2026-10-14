import {
  categoryBySlug,
  createProvider,
  createRequest,
  createUser,
  db,
  disconnectDb,
} from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

test("manages services and updates profile and request matching @smoke", async ({
  page,
  loginAs,
}) => {
  const { user, provider } = await createProvider({
    label: "services",
    categories: [],
  });
  const customer = await createUser({ label: "services-customer" });
  const job = await createRequest({
    customerId: customer.id,
    title: `Service matching ${Date.now()}`,
  });
  const category = await categoryBySlug("home-cleaning");
  const title = `Custom cleaning ${Date.now()}`;
  await loginAs(user);
  await page.goto("/dashboard/services");
  await expect(
    page.getByRole("heading", { level: 1, name: "Manage Services" }),
  ).toBeVisible();
  await expect(page.getByText(/You have no services yet/)).toBeVisible();
  await page.getByRole("button", { name: "Add Service" }).click();
  await page.getByLabel("Category", { exact: true }).selectOption(category.id);
  await page.getByLabel("Service title", { exact: true }).fill(title);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A careful home cleaning service");
  await page.getByLabel("Pricing", { exact: true }).selectOption("hourly");
  await page.getByLabel("Minimum price (€)", { exact: true }).fill("25");
  await page.getByLabel("Maximum price (€)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Save Service" }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const service = await db().service.findFirstOrThrow({
    where: { providerId: provider.id },
  });
  expect(service).toMatchObject({
    title,
    categoryId: category.id,
    priceMin: 25,
    priceMax: 60,
    isActive: true,
  });

  await page.goto(`/providers/${provider.id}`);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.goto("/dashboard/listings");
  await expect(
    page.getByRole("heading", { name: job.title, exact: true }),
  ).toBeVisible();

  await page.goto("/dashboard/services");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Service title", { exact: true })
    .fill(`${title} updated`);
  await page.getByLabel("Minimum price (€)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save Service" }).click();
  await expect(
    page.getByRole("heading", { name: `${title} updated`, exact: true }),
  ).toBeVisible();
  expect(
    await db().service.findUniqueOrThrow({ where: { id: service.id } }),
  ).toMatchObject({ priceMin: null });
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Activate", exact: true }),
  ).toBeVisible();
  await page.goto(`/providers/${provider.id}`);
  await expect(page.getByText(`${title} updated`, { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/dashboard/listings");
  await expect(
    page.getByRole("heading", { name: job.title, exact: true }),
  ).toHaveCount(0);

  await page.goto("/dashboard/services");
  await page.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Deactivate", exact: true }),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(/You have no services yet/)).toBeVisible();
  expect(
    await db().service.findUnique({ where: { id: service.id } }),
  ).toBeNull();
});
