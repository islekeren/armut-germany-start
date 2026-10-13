import { createDeal, db, disconnectDb } from "./support/data";
import { expect, test } from "./support/test";
test.afterAll(disconnectDb);

test("ineligible provider quote explains why acceptance is unavailable", async ({
  page,
  loginAs,
}) => {
  const { customer, serviceRequest } = await createDeal({
    label: "readiness-blocked",
  });
  await loginAs(customer);
  await page.route(
    `**/api/quotes/request/${serviceRequest.id}`,
    async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: body.map((quote: object) => ({
          ...quote,
          paymentEligibility: {
            eligible: false,
            reason: "verification_incomplete",
          },
        })),
      });
    },
  );
  await page.goto(`/my-requests/${serviceRequest.id}`);
  await expect(
    page.getByText(
      "The provider has not completed payment verification. This quote cannot be accepted yet.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept Quote" })).toHaveCount(
    0,
  );
});

test("readiness changing after render is handled without accepting the quote", async ({
  page,
  loginAs,
}) => {
  const { customer, serviceRequest, quote } = await createDeal({
    label: "readiness-changed",
  });
  await loginAs(customer);
  let rejected = false;
  await page.route(
    `**/api/quotes/request/${serviceRequest.id}`,
    async (route) => {
      const body = await (await route.fetch()).json();
      await route.fulfill({
        json: body.map((item: object) => ({
          ...item,
          paymentEligibility: {
            eligible: !rejected,
            reason: rejected ? "verification_incomplete" : "ready",
          },
        })),
      });
    },
  );
  await page.route(`**/api/quotes/${quote.id}/respond`, async (route) => {
    rejected = true;
    await route.fulfill({
      status: 400,
      json: { message: "Provider payment verification is incomplete" },
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/my-requests/${serviceRequest.id}`);
  await page.getByRole("button", { name: "Accept Quote" }).click();
  await expect(
    page.getByText(
      "The provider has not completed payment verification. This quote cannot be accepted yet.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    (await db().quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
  ).toBe("pending");
  expect(
    (
      await db().serviceRequest.findUniqueOrThrow({
        where: { id: serviceRequest.id },
      })
    ).status,
  ).toBe("open");
});
