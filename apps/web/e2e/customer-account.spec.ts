import {
  createDeal,
  createNotification,
  createUser,
  db,
  disconnectDb,
  PASSWORD,
} from "./support/data";
import { API_URL, expect, test } from "./support/test";

test.afterAll(disconnectDb);

test.describe("account settings", () => {
  test("updates the profile", async ({ page, loginAs }) => {
    const user = await createUser({ label: "settings", firstName: "Sam" });
    await loginAs(user);

    await page.goto("/settings");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(
      user.email,
    );
    await page.getByRole("textbox", { name: "First name" }).fill("Samira");
    await page.getByRole("textbox", { name: "Phone" }).fill("+49 30 7654321");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Profile updated successfully.")).toBeVisible();
    expect(
      await db().user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({
      firstName: "Samira",
      phone: "+49 30 7654321",
    });
  });

  test("changes the password", async ({ page, loginAs }) => {
    const user = await createUser({ label: "password" });
    await loginAs(user);
    const newPassword = "N3wPassword!";

    await page.goto("/settings");
    await page
      .getByRole("textbox", { name: "Current password" })
      .fill(PASSWORD);
    await page
      .getByRole("textbox", { name: "New password", exact: true })
      .fill(newPassword);
    await page
      .getByRole("textbox", { name: "Confirm new password" })
      .fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(
      page.getByText("Password changed successfully."),
    ).toBeVisible();
    const login = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: user.email, password: newPassword },
    });
    expect(login.ok()).toBeTruthy();
  });

  test("refuses mismatched new passwords", async ({ page, loginAs }) => {
    const user = await createUser({ label: "pw-mismatch" });
    await loginAs(user);

    await page.goto("/settings");
    await page
      .getByRole("textbox", { name: "Current password" })
      .fill(PASSWORD);
    await page
      .getByRole("textbox", { name: "New password", exact: true })
      .fill("N3wPassword!");
    await page
      .getByRole("textbox", { name: "Confirm new password" })
      .fill("Different1!");
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(
      page.getByText("The new passwords do not match."),
    ).toBeVisible();
  });

  test("deletes the account after typing the confirmation word", async ({
    page,
    loginAs,
  }) => {
    const user = await createUser({ label: "delete" });
    await loginAs(user);

    await page.goto("/settings");
    const submit = page.getByRole("button", { name: "Delete account" });
    await page
      .getByRole("textbox", { name: "Type “DELETE” to confirm" })
      .fill("remove");
    await submit.click();
    await expect(
      page.getByText("Please type “DELETE” to confirm."),
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "Type “DELETE” to confirm" })
      .fill("DELETE");
    await submit.click();

    await expect
      .poll(
        async () =>
          (await db().user.findUniqueOrThrow({ where: { id: user.id } }))
            .deletedAt,
      )
      .not.toBeNull();
    await expect(page).not.toHaveURL(/\/settings/);
  });

  test("blocks deletion while a booking is active", async ({
    page,
    loginAs,
  }) => {
    const { customer } = await createDeal({
      label: "delete-busy",
      bookingStatus: "confirmed",
    });
    await loginAs(customer);

    await page.goto("/settings");
    await page
      .getByRole("textbox", { name: "Type “DELETE” to confirm" })
      .fill("DELETE");
    await page.getByRole("button", { name: "Delete account" }).click();

    await expect(
      page.getByText(
        "You still have active bookings. Complete or cancel them before deleting your account.",
      ),
    ).toBeVisible();
    expect(
      (await db().user.findUniqueOrThrow({ where: { id: customer.id } }))
        .deletedAt,
    ).toBeNull();
  });
});

test.describe("notifications", () => {
  test("shows notifications and marks them all read", async ({
    page,
    loginAs,
  }) => {
    const user = await createUser({ label: "notify" });
    await createNotification({ userId: user.id, title: "New offer received" });
    await createNotification({
      userId: user.id,
      title: "Job completed",
      type: "booking_completed",
    });
    await loginAs(user);

    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "New offer received" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Job completed" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect
      .poll(() =>
        db().notification.count({ where: { userId: user.id, isRead: false } }),
      )
      .toBe(0);
  });
});
