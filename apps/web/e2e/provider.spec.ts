import {
  createDeal,
  createProvider,
  createRequest,
  createUser,
  db,
  disconnectDb,
} from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

function isoDate(daysAhead: number) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

test.describe("provider workspace", () => {
  test("sends an offer from open listings @smoke", async ({
    page,
    loginAs,
  }) => {
    const customer = await createUser({ label: "listing-customer" });
    const serviceRequest = await createRequest({
      customerId: customer.id,
      title: `Listing to quote ${Date.now()}`,
    });
    const { user, provider } = await createProvider({ label: "offerer" });
    await loginAs(user);

    await page.goto("/dashboard/listings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Open Listings" }),
    ).toBeVisible();
    await page.getByRole("heading", { name: serviceRequest.title }).click();
    await page.locator('input[placeholder="100"]').fill("145");
    await page.locator('input[type="date"]').fill(isoDate(14));
    await page
      .getByPlaceholder("Describe your offer and what's included...")
      .fill(
        "I can complete this cleaning in one visit and bring all materials.",
      );
    await page.getByRole("button", { name: "Send Offer" }).click();

    await expect(page.getByText("Offer sent successfully")).toBeVisible();
    const quote = await db().quote.findFirstOrThrow({
      where: { requestId: serviceRequest.id, providerId: provider.id },
    });
    expect(quote).toMatchObject({ price: 145, status: "pending" });

    await page.goto("/dashboard/offers");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pending Offers" }),
    ).toBeVisible();
    await expect(page.getByText(serviceRequest.title).first()).toBeVisible();
  });

  test("unapproved providers see the review notice and cannot quote", async ({
    page,
    loginAs,
  }) => {
    const customer = await createUser({ label: "blocked-customer" });
    const serviceRequest = await createRequest({
      customerId: customer.id,
      title: `Blocked listing ${Date.now()}`,
    });
    const { user, provider } = await createProvider({
      label: "unapproved",
      isApproved: false,
    });
    await loginAs(user);

    await page.goto("/dashboard");
    await expect(
      page.getByText("Your provider profile is under review"),
    ).toBeVisible();

    await page.goto("/dashboard/listings");
    await page.getByRole("heading", { name: serviceRequest.title }).click();
    await page
      .getByPlaceholder("Describe your offer and what's included...")
      .fill("Let me help.");

    await expect(
      page.getByRole("button", { name: "Send Offer" }),
    ).toBeDisabled();
    expect(await db().quote.count({ where: { providerId: provider.id } })).toBe(
      0,
    );
  });

  test("marks an order as completed and waits for the customer", async ({
    page,
    loginAs,
  }) => {
    const { providerUser, booking, serviceRequest } = await createDeal({
      label: "order",
      bookingStatus: "confirmed",
      title: `Order to finish ${Date.now()}`,
    });
    await loginAs(providerUser);

    await page.goto("/dashboard/orders");
    await expect(
      page.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: new RegExp(serviceRequest.title) })
      .click();
    await page.getByRole("button", { name: "Mark as Completed" }).click();

    await expect(
      page.getByText(
        "Completion request sent to customer. Waiting for approval.",
      ),
    ).toBeVisible();
    expect(
      (await db().booking.findUniqueOrThrow({ where: { id: booking!.id } }))
        .status,
    ).toBe("completion_pending");
  });

  test("replies to a review", async ({ page, loginAs }) => {
    const { providerUser, customer, booking } = await createDeal({
      label: "reply",
      bookingStatus: "completed",
    });
    const review = await db().review.create({
      data: {
        bookingId: booking!.id,
        reviewerId: customer.id,
        revieweeId: providerUser.id,
        rating: 5,
        comment: "Brilliant job, spotless.",
      },
    });
    await loginAs(providerUser);

    await page.goto("/dashboard/reviews");
    await expect(page.getByText("Brilliant job, spotless.")).toBeVisible();
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page
      .getByPlaceholder("Write your reply...")
      .fill("Thanks, see you next time!");
    await page
      .getByRole("button", { name: /^(Send|Submit|Reply)/ })
      .last()
      .click();

    await expect(page.getByText("Thanks, see you next time!")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await db().review.findUniqueOrThrow({ where: { id: review.id } }))
            .providerReply,
      )
      .toBe("Thanks, see you next time!");
  });

  test("edits the public profile", async ({ page, loginAs }) => {
    const { user, provider } = await createProvider({ label: "profile-edit" });
    const newName = `Renamed Co ${Date.now()}`;
    await loginAs(user);

    await page.goto("/dashboard/profile");
    await expect(
      page.getByRole("heading", { level: 1, name: "Edit Profile" }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Company Name" }).fill(newName);
    // The company card has its own save button, separate from the bottom one.
    await page.getByRole("button", { name: "Save Changes" }).first().click();

    await expect
      .poll(
        async () =>
          (
            await db().provider.findUniqueOrThrow({
              where: { id: provider.id },
            })
          ).companyName,
      )
      .toBe(newName);
    await page.goto(`/providers/${provider.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: newName }),
    ).toBeVisible();
  });

  test("provider pages render for an approved provider", async ({
    page,
    loginAs,
  }) => {
    const { providerUser } = await createDeal({
      label: "tour",
      bookingStatus: "confirmed",
    });
    await loginAs(providerUser);

    const pages: [string, string][] = [
      ["/dashboard", "Welcome, Pat! 👋"],
      ["/dashboard/calendar", "Calendar"],
      ["/dashboard/reviews", "My Reviews"],
      ["/dashboard/settings", "Settings"],
      ["/dashboard/services", "Manage Services"],
      ["/dashboard/finances", "Finances"],
      ["/dashboard/messages", "Messages"],
    ];
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    }
  });

  test("customers are kept out of the provider dashboard", async ({
    page,
    loginAs,
  }) => {
    const customer = await createUser({ label: "not-provider" });
    await loginAs(customer);

    await page.goto("/dashboard/listings");

    await expect(
      page.getByRole("heading", { level: 1, name: "Open Listings" }),
    ).toHaveCount(0);
  });
});
