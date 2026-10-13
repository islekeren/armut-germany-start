import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect, API_URL } from "./support/test";
import { createUser, db, disconnectDb, PASSWORD } from "./support/data";
import { createHash } from "node:crypto";
import en from "../messages/en.json";
import de from "../messages/de.json";

// Recovery URLs and request bodies contain secrets: do not record traces/videos.
test.use({ trace: "off", video: "off" });
test.afterAll(disconnectDb);
const mailbox = resolve(process.env.EMAIL_LOCAL_DIR || "../api/.local-mail");

async function resetLink(email: string) {
  let link = "";
  await expect.poll(async () => {
    for (const name of await readdir(mailbox).catch(() => [])) {
      if (!name.endsWith(".json")) continue;
      const mail = JSON.parse(await readFile(resolve(mailbox, name), "utf8")) as { to: string; text: string };
      if (mail.to === email) {
        link = mail.text.match(/https?:\/\/[^\s]+/)?.[0] || "";
        return Boolean(link);
      }
    }
    return false;
  }).toBe(true);
  return link;
}

for (const locale of ["en", "de"] as const) {
  const copy = (locale === "en" ? en : de).auth.recovery;
  test(`request and reset with local mail in ${locale} @smoke`, async ({ page }) => {
    const user = await createUser({ label: `recovery-${locale}` });
    await page.context().addCookies([{ name: "locale", value: locale, url: "http://localhost:3000" }]);
    if (locale === "de") await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.name));
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: copy.requestTitle })).toBeVisible();
    await page.getByLabel(copy.email).fill(user.email);
    await page.getByRole("button", { name: copy.requestSubmit }).click();
    await expect(page.getByRole("status")).toContainText(copy.requestSuccess);
    const link = await resetLink(user.email);
    // Email locale wins even when the browser cookie differs.
    await page.context().addCookies([{ name: "locale", value: locale === "de" ? "en" : "de", url: "http://localhost:3000" }]);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: copy.resetTitle })).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash.length).toBe(0);
    await page.getByLabel(copy.password, { exact: true }).fill("NewPassword123!");
    await page.getByLabel(copy.confirm).fill("NewPassword123!");
    await page.getByRole("button", { name: copy.resetSubmit }).click();
    await expect(page.getByRole("status")).toContainText(copy.resetSuccess);
    const oldLogin = await page.request.post(`${API_URL}/api/auth/login`, { data: { email: user.email, password: PASSWORD } });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await page.request.post(`${API_URL}/api/auth/login`, { data: { email: user.email, password: "NewPassword123!" } });
    expect(newLogin.status()).toBe(201);
    await page.screenshot({ path: `/tmp/arm-recovery-${locale}.png`, fullPage: true });
    expect(errors).toHaveLength(0);
    await page.goto(link);
    await page.getByLabel(copy.password, { exact: true }).fill("AnotherPassword123!");
    await page.getByLabel(copy.confirm).fill("AnotherPassword123!");
    await page.getByRole("button", { name: copy.resetSubmit }).click();
    await expect(page.getByRole("alert")).toContainText(copy.invalidLink);
  });
}

test("expired and malformed links offer recovery without exposing a secret", async ({ page }) => {
  const user = await createUser({ label: "expired-recovery" });
  await page.request.post(`${API_URL}/api/auth/forgot-password`, { data: { email: user.email, locale: "en" } });
  const link = await resetLink(user.email);
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token")!;
  await db().passwordResetToken.updateMany({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, data: { expiresAt: new Date(0) } });
  await page.goto(link);
  await page.getByLabel(en.auth.recovery.password, { exact: true }).fill("NewPassword123!");
  await page.getByLabel(en.auth.recovery.confirm).fill("NewPassword123!");
  await page.getByRole("button", { name: en.auth.recovery.resetSubmit }).click();
  await expect(page.getByRole("alert")).toContainText(en.auth.recovery.invalidLink);
  await page.goto("/reset-password#token=invalid");
  await expect(page.getByRole("alert")).toContainText(en.auth.recovery.invalidLink);
  await expect(page.getByRole("link", { name: en.auth.recovery.requestAgain })).toBeVisible();
});
