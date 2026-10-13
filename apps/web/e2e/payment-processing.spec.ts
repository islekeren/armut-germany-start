import { createDeal, disconnectDb } from "./support/data";
import { expect, test } from "./support/test";
test.afterAll(disconnectDb);

test.describe("payment and completion processing (API boundary mocked)", () => {
  test("refresh without success query keeps processing and hides Pay @smoke", async ({
    page,
    loginAs,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const { customer, booking } = await createDeal({
      label: "processing",
      bookingStatus: "confirmed",
    });
    await loginAs(customer);
    await page.route(`**/api/bookings/${booking!.id}`, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        json: {
          ...body,
          paymentsAvailable: true,
          payment: {
            id: "payment",
            checkoutState: "confirmation_processing",
            canRetry: false,
          },
        },
      });
    });
    await page.goto(`/bookings/${booking!.id}`);
    await expect(
      page.getByText("Payment confirmation is processing.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pay and confirm booking" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "/tmp/armut-payment-processing-desktop.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByText("Payment confirmation is processing.", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/armut-payment-processing-mobile.png" });
    await page.reload();
    await expect(
      page.getByText("Payment confirmation is processing.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pay and confirm booking" }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
  test("success return polls to paid without creating another Checkout", async ({
    page,
    loginAs,
  }) => {
    const { customer, booking } = await createDeal({
      label: "processing-paid",
      bookingStatus: "confirmed",
    });
    await loginAs(customer);
    let terminal = false;
    let creates = 0;
    await page.route("**/api/payments/checkout-session", async (route) => {
      creates++;
      await route.abort();
    });
    await page.route(`**/api/bookings/${booking!.id}`, async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: {
          ...body,
          paymentsAvailable: true,
          paymentStatus: terminal ? "paid" : "pending",
          payment: {
            id: "payment",
            checkoutState: terminal ? "paid" : "confirmation_processing",
            canRetry: false,
          },
        },
      });
    });
    await page.goto(`/bookings/${booking!.id}?payment=success`);
    await expect(
      page.getByText("Payment confirmation is processing.", { exact: true }),
    ).toBeVisible();
    terminal = true;
    await expect(
      page.getByRole("button", { name: "Pay and confirm booking" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Payment confirmed. Thank you!", { exact: true }),
    ).toBeVisible();
    expect(creates).toBe(0);
  });
  test("processing can transition to expired and offer retry", async ({
    page,
    loginAs,
  }) => {
    const { customer, booking } = await createDeal({
      label: "processing-expired",
      bookingStatus: "confirmed",
    });
    await loginAs(customer);
    let terminal = false;
    await page.route(`**/api/bookings/${booking!.id}`, async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: {
          ...body,
          paymentsAvailable: true,
          paymentStatus: terminal ? "failed" : "pending",
          payment: {
            id: "payment",
            checkoutState: terminal ? "expired" : "confirmation_processing",
            canRetry: terminal,
          },
        },
      });
    });
    await page.goto(`/bookings/${booking!.id}`);
    await expect(
      page.getByText("Payment confirmation is processing.", { exact: true }),
    ).toBeVisible();
    terminal = true;
    await expect(
      page.getByRole("button", { name: "Pay and confirm booking" }),
    ).toBeVisible();
  });
  test("client timeout followed by server success shows completed, without a second submission", async ({
    page,
    loginAs,
  }) => {
    const { customer, booking } = await createDeal({
      label: "completion-timeout",
      bookingStatus: "completion_pending",
      paid: true,
    });
    await loginAs(customer);
    let requested = false;
    let submits = 0;
    await page.route(`**/api/bookings/${booking!.id}/status`, async (route) => {
      requested = true;
      submits++;
      await route.abort("timedout");
    });
    await page.route(`**/api/bookings/${booking!.id}`, async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: {
          ...body,
          paymentsAvailable: true,
          status: requested ? "completed" : "completion_pending",
          payment: {
            ...body.payment,
            completionOperation: requested
              ? { id: "op", status: "succeeded" }
              : null,
          },
        },
      });
    });
    await page.goto(`/bookings/${booking!.id}`);
    await page
      .getByRole("button", { name: "Confirm job is completed" })
      .click();
    await expect(
      page.getByText("Booking marked as completed.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "The service is temporarily unavailable. Please try again shortly.",
      ),
    ).toHaveCount(0);
    expect(submits).toBe(1);
  });
  test("genuine Stripe rejection is shown as a completion failure", async ({
    page,
    loginAs,
  }) => {
    const { customer, booking } = await createDeal({
      label: "completion-failed",
      bookingStatus: "completion_pending",
      paid: true,
    });
    await loginAs(customer);
    await page.route(`**/api/bookings/${booking!.id}`, async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: {
          ...body,
          paymentsAvailable: true,
          payment: {
            ...body.payment,
            completionOperation: {
              id: "op",
              status: "failed",
              errorCode: "stripe_rejected",
            },
          },
        },
      });
    });
    await page.goto(`/bookings/${booking!.id}`);
    await expect(
      page.getByText(
        "Completion could not be confirmed. Please contact support.",
        { exact: true },
      ),
    ).toBeVisible();
  });
  test("German processing copy appears without a return query", async ({
    page,
    loginAs,
  }) => {
    const { customer, booking } = await createDeal({
      label: "processing-de",
      bookingStatus: "confirmed",
    });
    await page
      .context()
      .addCookies([
        { name: "locale", value: "de", url: "http://localhost:3000" },
      ]);
    await loginAs(customer);
    await page.route(`**/api/bookings/${booking!.id}`, async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: {
          ...body,
          paymentsAvailable: true,
          payment: {
            id: "payment",
            checkoutState: "confirmation_processing",
            canRetry: false,
          },
        },
      });
    });
    await page.goto(`/bookings/${booking!.id}`);
    await expect(
      page.getByText("Die Zahlungsbestätigung wird verarbeitet.", {
        exact: true,
      }),
    ).toBeVisible();
  });
});
