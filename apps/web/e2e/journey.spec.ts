import { createProvider, createUser, db, disconnectDb } from "./support/data";
import { expect, signIn, test, setEnglishLocale } from "./support/test";

test.afterAll(disconnectDb);

function localDateTime(daysAhead: number) {
  const when = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T09:00`;
}

// The whole marketplace loop through the UI, with the customer and the
// provider in separate browser contexts.
test("request → offer → booking → completion → review → reply @smoke", async ({
  browser,
  page: customerPage,
  loginAs,
}) => {
  test.setTimeout(180_000);
  const customer = await createUser({
    label: "journey-customer",
    firstName: "Jordan",
  });
  const { user: providerUser, provider } = await createProvider({
    label: "journey-provider",
    companyName: `Journey Cleaners ${Date.now()}`,
  });
  const title = `Journey deep clean ${Date.now()}`;

  const providerContext = await browser.newContext();
  const providerPage = await providerContext.newPage();
  await setEnglishLocale(providerPage);
  await signIn(providerPage, providerUser);
  await loginAs(customer);
  customerPage.on("dialog", (dialog) => dialog.accept());

  await test.step("customer creates a request", async () => {
    await customerPage.goto("/create-request");
    await customerPage
      .getByRole("button", { name: "Cleaning & Home Care" })
      .click();
    await customerPage.getByRole("button", { name: "Home Cleaning" }).click();
    await customerPage
      .getByPlaceholder("e.g., Deep cleaning for 3-room apartment")
      .fill(title);
    await customerPage
      .getByPlaceholder(
        "Describe your request in detail. What exactly do you need? Are there any special requirements?",
      )
      .fill(
        "Two bedrooms, kitchen, and bathroom. Materials should be included.",
      );
    await customerPage.getByPlaceholder("e.g., 10115").fill("10115");
    await customerPage.getByPlaceholder("e.g., Berlin").fill("Berlin");
    await customerPage
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await customerPage.getByRole("button", { name: "Submit Request" }).click();
    await expect(customerPage).toHaveURL(/\/my-requests$/);
  });
  const serviceRequest = await db().serviceRequest.findFirstOrThrow({
    where: { title },
  });

  await test.step("provider sends an offer", async () => {
    await providerPage.goto("/dashboard/listings");
    await providerPage.getByRole("heading", { name: title }).click();
    await providerPage.locator('input[placeholder="100"]').fill("180");
    await providerPage
      .locator('input[type="date"]')
      .fill(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
    await providerPage
      .getByPlaceholder("Describe your offer and what's included...")
      .fill("Full clean with eco products, about four hours.");
    await providerPage.getByRole("button", { name: "Send Offer" }).click();
    await expect(
      providerPage.getByText("Offer sent successfully"),
    ).toBeVisible();
  });

  await test.step("customer is notified, accepts, and books", async () => {
    await customerPage.goto("/notifications");
    await expect(
      customerPage.getByRole("heading", { name: "New offer received" }).first(),
    ).toBeVisible();

    await customerPage.goto(`/my-requests/${serviceRequest.id}`);
    await customerPage.getByRole("button", { name: "Accept Quote" }).click();
    await expect(customerPage).toHaveURL(
      /\/bookings\/new\?quote=.+&accepted=1/,
    );

    await customerPage
      .locator('input[type="datetime-local"]')
      .fill(localDateTime(6));
    await customerPage.getByRole("button", { name: "Create Booking" }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  });
  const booking = await db().booking.findFirstOrThrow({
    where: { quote: { requestId: serviceRequest.id } },
  });
  expect(booking).toMatchObject({ status: "confirmed", totalPrice: 180 });

  await test.step("provider marks the job as completed", async () => {
    await providerPage.goto("/dashboard/orders");
    await providerPage.getByRole("button", { name: new RegExp(title) }).click();
    await providerPage
      .getByRole("button", { name: "Mark as Completed" })
      .click();
    await expect(
      providerPage.getByText(
        "Completion request sent to customer. Waiting for approval.",
      ),
    ).toBeVisible();
  });

  await test.step("customer confirms completion and reviews", async () => {
    await customerPage.goto(`/bookings/${booking.id}`);
    await customerPage
      .getByRole("button", { name: "Confirm job is completed" })
      .click();
    await expect(
      customerPage.getByText("Booking marked as completed."),
    ).toBeVisible();
    await customerPage.getByRole("button", { name: "5", exact: true }).click();
    await customerPage
      .getByPlaceholder("Tell others what went well and what could be better.")
      .fill("Spotless result, would book again.");
    await customerPage.getByRole("button", { name: "Submit Review" }).click();
    await expect(
      customerPage.getByText("Review submitted successfully"),
    ).toBeVisible();
  });

  await test.step("provider replies and the review is public", async () => {
    await providerPage.goto("/dashboard/reviews");
    await providerPage
      .getByRole("button", { name: "Reply", exact: true })
      .click();
    await providerPage
      .getByPlaceholder("Write your reply...")
      .fill("Thank you, Jordan!");
    await providerPage
      .getByRole("button", { name: /^(Send|Submit|Reply)/ })
      .last()
      .click();
    await expect(providerPage.getByText("Thank you, Jordan!")).toBeVisible();

    await customerPage.goto(`/providers/${provider.id}`);
    await expect(
      customerPage.getByText("Spotless result, would book again."),
    ).toBeVisible();
    await expect(customerPage.getByText("Thank you, Jordan!")).toBeVisible();
  });

  expect(
    (
      await db().serviceRequest.findUniqueOrThrow({
        where: { id: serviceRequest.id },
      })
    ).status,
  ).toBe("completed");
  await providerContext.close();
});
