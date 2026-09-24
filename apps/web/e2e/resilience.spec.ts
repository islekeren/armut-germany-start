import { createUser, disconnectDb } from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

// The UI should degrade to an error message, never a blank page or crash.
const UNAVAILABLE =
  "The service is temporarily unavailable. Please try again shortly.";
test.describe("API failure handling", () => {
  test("my requests shows an error when the API fails", async ({
    page,
    loginAs,
  }) => {
    const customer = await createUser({ label: "api-500" });
    await loginAs(customer);
    await page.route("**/api/requests/my**", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"message":"boom"}',
      }),
    );

    await page.goto("/my-requests");

    await expect(
      page.getByRole("heading", { level: 1, name: "My Requests" }),
    ).toBeVisible();
    await expect(page.getByText(UNAVAILABLE)).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
  });

  test("notifications shows an error when the API is unreachable", async ({
    page,
    loginAs,
  }) => {
    const customer = await createUser({ label: "api-down" });
    await loginAs(customer);
    await page.route("**/api/notifications**", (route) =>
      route.abort("connectionrefused"),
    );

    await page.goto("/notifications");

    await expect(
      page.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(
      page.getByText(/temporarily unavailable|Failed to load notifications/),
    ).toBeVisible();
  });

  test("an expired session sends the user back to login", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("armut_access_token", "expired.token.value");
      localStorage.setItem("armut_refresh_token", "expired.refresh.value");
      localStorage.setItem(
        "armut_user",
        JSON.stringify({
          id: "gone",
          email: "gone@e2e.test",
          userType: "customer",
        }),
      );
    });

    await page.goto("/my-requests");

    await expect(page).toHaveURL(/\/login/);
  });
});
