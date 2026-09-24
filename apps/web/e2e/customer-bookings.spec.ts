import { createDeal, db, disconnectDb } from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

function localDateTime(daysAhead: number) {
  const when = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T14:30`;
}

test.describe("customer bookings", () => {
  test("lists bookings and filters by status", async ({ page, loginAs }) => {
    const { customer, serviceRequest } = await createDeal({
      label: "bk-list",
      bookingStatus: "confirmed",
      title: `Upcoming clean ${Date.now()}`,
    });
    await loginAs(customer);

    await page.goto("/bookings");
    await expect(
      page.getByRole("heading", { level: 1, name: "My Bookings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: serviceRequest.title }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancelled" }).click();
    // Only the "Next booking" card (outside the tabbed list) still names it.
    await expect(page.getByText("No bookings yet")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: serviceRequest.title }),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "All" }).click();
    await page.getByRole("link", { name: "View Details" }).first().click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  });

  test("reschedules a booking back to pending", async ({ page, loginAs }) => {
    const { customer, booking } = await createDeal({
      label: "bk-resched",
      bookingStatus: "confirmed",
    });
    await loginAs(customer);

    await page.goto(`/bookings/${booking!.id}`);
    await page.locator('input[type="datetime-local"]').fill(localDateTime(10));
    await page.getByRole("button", { name: "Reschedule" }).click();

    await expect
      .poll(
        async () =>
          (await db().booking.findUniqueOrThrow({ where: { id: booking!.id } }))
            .status,
      )
      .toBe("pending");
  });

  test("cancels a booking and reopens the request", async ({
    page,
    loginAs,
  }) => {
    const { customer, booking, serviceRequest } = await createDeal({
      label: "bk-cancel",
      bookingStatus: "confirmed",
    });
    await loginAs(customer);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(`/bookings/${booking!.id}`);
    await page.getByRole("button", { name: "Cancel Booking" }).click();

    await expect
      .poll(
        async () =>
          (await db().booking.findUniqueOrThrow({ where: { id: booking!.id } }))
            .status,
      )
      .toBe("cancelled");
    expect(
      (
        await db().serviceRequest.findUniqueOrThrow({
          where: { id: serviceRequest.id },
        })
      ).status,
    ).toBe("open");
  });

  test("confirms completion and leaves a review", async ({ page, loginAs }) => {
    const { customer, booking, provider } = await createDeal({
      label: "bk-review",
      bookingStatus: "completion_pending",
    });
    await loginAs(customer);

    await page.goto(`/bookings/${booking!.id}`);
    await page
      .getByRole("button", { name: "Confirm job is completed" })
      .click();
    await expect(page.getByText("Booking marked as completed.")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Leave a review" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page
      .getByPlaceholder("Tell others what went well and what could be better.")
      .fill("On time and thorough.");
    await page.getByRole("button", { name: "Submit Review" }).click();

    await expect(page.getByText("Review submitted successfully")).toBeVisible();
    const review = await db().review.findUniqueOrThrow({
      where: { bookingId: booking!.id },
    });
    expect(review).toMatchObject({
      rating: 4,
      comment: "On time and thorough.",
    });
    expect(
      (await db().provider.findUniqueOrThrow({ where: { id: provider.id } }))
        .totalReviews,
    ).toBe(1);
  });
});
