import { createProvider, createUser, db, disconnectDb } from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

test.describe("admin", () => {
  test("approves a pending provider", async ({ page, loginAs }) => {
    const admin = await createUser({ label: "admin", userType: "admin" });
    const companyName = `Awaiting Approval ${Date.now()}`;
    const { provider } = await createProvider({
      label: "pending",
      companyName,
      isApproved: false,
    });
    await loginAs(admin);

    await page.goto("/admin/providers");
    await expect(
      page.getByRole("heading", { level: 1, name: "Approve providers" }),
    ).toBeVisible();
    const approveButton = page.getByRole("button", { name: "Approve" });
    const card = page
      .locator("li, article, div")
      .filter({ hasText: companyName })
      .filter({ has: approveButton })
      .last();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();

    await expect(
      page.getByText(`${companyName} has been approved.`),
    ).toBeVisible();
    expect(
      (await db().provider.findUniqueOrThrow({ where: { id: provider.id } }))
        .isApproved,
    ).toBe(true);
  });

  test("non-admins see the forbidden notice", async ({ page, loginAs }) => {
    const customer = await createUser({ label: "not-admin" });
    await loginAs(customer);

    await page.goto("/admin/providers");

    await expect(
      page.getByText("This page is only available to administrators."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });
});
