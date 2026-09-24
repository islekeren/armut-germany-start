import {
  createUser,
  disconnectDb,
  PASSWORD,
  uniqueEmail,
} from "./support/data";
import { expect, test } from "./support/test";

test.afterAll(disconnectDb);

test.describe("authentication", () => {
  test("a customer can register and lands signed in", async ({ page }) => {
    const email = uniqueEmail("register");

    await page.goto("/register");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create Account" }),
    ).toBeVisible();

    const textInputs = page.locator('form input[type="text"]');
    await textInputs.nth(0).fill("Robin");
    await textInputs.nth(1).fill("Register");
    await page.locator('form input[type="email"]').fill(email);
    await page.locator('form input[type="password"]').nth(0).fill(PASSWORD);
    await page.locator('form input[type="password"]').nth(1).fill(PASSWORD);
    await page
      .getByRole("checkbox", { name: /I accept the Privacy Policy/ })
      .check();
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).not.toHaveURL(/\/register/);
    await expect(page.getByRole("button", { name: /Profile/ })).toBeVisible();
  });

  test("registration refuses mismatched passwords", async ({ page }) => {
    await page.goto("/register");
    const textInputs = page.locator('form input[type="text"]');
    await textInputs.nth(0).fill("Robin");
    await textInputs.nth(1).fill("Register");
    await page
      .locator('form input[type="email"]')
      .fill(uniqueEmail("mismatch"));
    await page.locator('form input[type="password"]').nth(0).fill(PASSWORD);
    await page
      .locator('form input[type="password"]')
      .nth(1)
      .fill(`${PASSWORD}x`);
    await page
      .getByRole("checkbox", { name: /I accept the Privacy Policy/ })
      .check();
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole("button", { name: /Profile/ })).toHaveCount(0);
  });

  test("choosing the provider role on register continues to onboarding", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: /Provider/ }).click();
    const textInputs = page.locator('form input[type="text"]');
    await textInputs.nth(0).fill("Pat");
    await textInputs.nth(1).fill("Provider");
    await page.locator('form input[type="email"]').fill(uniqueEmail("onboard"));
    await page.locator('form input[type="password"]').nth(0).fill(PASSWORD);
    await page.locator('form input[type="password"]').nth(1).fill(PASSWORD);
    await page
      .getByRole("checkbox", { name: /I accept the Privacy Policy/ })
      .check();
    await page.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL(/\/provider-onboarding\?/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Create Your Provider Profile",
      }),
    ).toBeVisible();
  });

  test("login honours the redirect parameter @smoke", async ({ page }) => {
    const user = await createUser({ label: "login" });

    await page.goto("/my-requests");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fmy-requests/);

    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/my-requests$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "My Requests" }),
    ).toBeVisible();
  });

  test("login rejects a wrong password", async ({ page }) => {
    const user = await createUser({ label: "badlogin" });

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill("WrongPassword1!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /Profile/ })).toHaveCount(0);
  });

  test("login ignores off-site redirect targets", async ({ page }) => {
    const user = await createUser({ label: "redirect" });

    await page.goto("/login?redirect=//evil.example.com");
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    // Falls back to the in-app default instead of leaving the site.
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\//);
    await expect(page).not.toHaveURL(/evil/);
  });

  test("logging out clears the session", async ({ page, loginAs }) => {
    const user = await createUser({ label: "logout", firstName: "Lou" });
    await loginAs(user);

    await page.goto("/customer-dashboard");
    await page.getByRole("button", { name: /Profile/ }).click();
    await page.getByRole("button", { name: "Log out" }).first().click();
    // Logout does a full navigation to the home page; let it finish first.
    await page.waitForURL("http://localhost:3000/");

    await page.goto("/my-requests");
    await expect(page).toHaveURL(/\/login/);
    const token = await page.evaluate(() =>
      localStorage.getItem("armut_access_token"),
    );
    expect(token).toBeNull();
  });
});
