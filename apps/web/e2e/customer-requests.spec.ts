import {
  createDeal,
  createProvider,
  createQuote,
  createRequest,
  createUser,
  db,
  disconnectDb,
} from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

test.describe("customer requests", () => {
  test("creates a request through the wizard @smoke", async ({
    page,
    loginAs,
  }) => {
    const customer = await createUser({ label: "wizard" });
    await loginAs(customer);
    const title = `Post-renovation deep cleaning ${Date.now()}`;

    await page.goto("/create-request");
    await expect(
      page.getByRole("heading", { name: "What do you need?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cleaning & Home Care" }).click();
    await page.getByRole("button", { name: "Home Cleaning" }).click();
    await page
      .getByPlaceholder("e.g., Deep cleaning for 3-room apartment")
      .fill(title);
    await page
      .getByPlaceholder(
        "Describe your request in detail. What exactly do you need? Are there any special requirements?",
      )
      .fill(
        "Please deep clean a 3-room apartment after renovation work is finished.",
      );
    await page.getByPlaceholder("e.g., 10115").fill("10115");
    await page.getByPlaceholder("e.g., Berlin").fill("Berlin");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Review your request" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Submit Request" }).click();

    await expect(page).toHaveURL(/\/my-requests$/);
    // The list opens on the "Booked" tab; new requests live under "Active".
    await page.getByRole("button", { name: "Active" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const stored = await db().serviceRequest.findFirstOrThrow({
      where: { customerId: customer.id, title },
    });
    expect(stored).toMatchObject({
      status: "open",
      postalCode: "10115",
      requestBranch: "home-cleaning",
    });
  });

  test("lists requests by status tab", async ({ page, loginAs }) => {
    const customer = await createUser({ label: "tabs" });
    const open = await createRequest({
      customerId: customer.id,
      title: `Active job ${Date.now()}`,
    });
    const cancelled = await createRequest({
      customerId: customer.id,
      title: `Cancelled job ${Date.now()}`,
      status: "cancelled",
    });
    await loginAs(customer);

    await page.goto("/my-requests");
    await page.getByRole("button", { name: "Active" }).click();
    await expect(page.getByRole("heading", { name: open.title })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: cancelled.title }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Cancelled" }).click();
    await expect(
      page.getByRole("heading", { name: cancelled.title }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: open.title })).toHaveCount(
      0,
    );
  });

  test("accepting a quote leads to booking creation", async ({
    page,
    loginAs,
  }) => {
    const { customer, provider, serviceRequest, quote } = await createDeal({
      label: "accept",
      title: `Accept me ${Date.now()}`,
    });
    // A competing offer that must be rejected when the first is accepted.
    const { provider: rival } = await createProvider({ label: "accept-rival" });
    const rivalQuote = await createQuote({
      requestId: serviceRequest.id,
      providerId: rival.id,
      customerId: customer.id,
      price: 999,
    });
    await loginAs(customer);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(`/my-requests/${serviceRequest.id}`);
    await expect(
      page.getByRole("heading", { name: "2 quotes received" }),
    ).toBeVisible();
    await page
      .locator("div", {
        has: page.getByRole("heading", { name: provider.companyName! }),
      })
      .getByRole("button", { name: "Accept Quote" })
      .last()
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/bookings/new\\?quote=${quote.id}&accepted=1`),
    );
    await expect(
      page.getByRole("heading", { name: "Complete your booking" }),
    ).toBeVisible();
    // Accepting alone never creates a booking.
    expect(await db().booking.count({ where: { quoteId: quote.id } })).toBe(0);
    expect(
      (await db().quote.findUniqueOrThrow({ where: { id: rivalQuote.id } }))
        .status,
    ).toBe("rejected");

    const when = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    when.setHours(10, 0, 0, 0);
    const local = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(
      when.getDate(),
    ).padStart(2, "0")}T10:00`;
    await page.locator('input[type="datetime-local"]').fill(local);
    await page.getByRole("button", { name: "Create Booking" }).click();

    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: serviceRequest.title }),
    ).toBeVisible();
    const booking = await db().booking.findUniqueOrThrow({
      where: { quoteId: quote.id },
    });
    expect(booking.status).toBe("confirmed");
  });

  test("a pending quote cannot be booked directly", async ({
    page,
    loginAs,
  }) => {
    const { customer, quote } = await createDeal({ label: "notready" });
    await loginAs(customer);

    await page.goto(`/bookings/new?quote=${quote.id}`);

    await expect(
      page.getByRole("heading", { name: "This quote is not ready to book" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Booking" }),
    ).toHaveCount(0);
  });

  test("customers cannot open another customer's request", async ({
    page,
    loginAs,
  }) => {
    const { serviceRequest } = await createDeal({ label: "foreign" });
    const stranger = await createUser({ label: "stranger" });
    await loginAs(stranger);

    await page.goto(`/my-requests/${serviceRequest.id}`);

    await expect(
      page.getByRole("button", { name: "Accept Quote" }),
    ).toHaveCount(0);
    await expect(page.getByText("Torstrasse 1")).toHaveCount(0);
  });
});
