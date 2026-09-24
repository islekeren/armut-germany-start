import { test as base, expect, type Page } from "@playwright/test";
import { PASSWORD } from "./data";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type LoginUser = { email: string };

export const WEB_URL = "http://localhost:3000";

export async function setEnglishLocale(page: Page) {
  await page
    .context()
    .addCookies([{ name: "locale", value: "en", url: WEB_URL }]);
}

/**
 * Logs in through the API and seeds the same localStorage keys AuthContext
 * writes, so tests start authenticated without driving the login form.
 */
export async function signIn(page: Page, user: LoginUser) {
  const response = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: user.email, password: PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const session = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    user: unknown;
  };

  // Init scripts run on every navigation; seed only the first time in this
  // tab so logging out (or token refresh) is not undone by the next page load.
  await page.addInitScript((s) => {
    if (window.sessionStorage.getItem("e2e-session-seeded")) return;
    window.sessionStorage.setItem("e2e-session-seeded", "1");
    window.localStorage.setItem("armut_access_token", s.accessToken);
    window.localStorage.setItem("armut_refresh_token", s.refreshToken);
    window.localStorage.setItem("armut_user", JSON.stringify(s.user));
  }, session);

  return session;
}

export const test = base.extend<{
  loginAs: (user: LoginUser) => Promise<{ accessToken: string }>;
}>({
  // Fixture callbacks name the Playwright `use` argument `provide` so the
  // React hooks lint rule does not mistake it for a hook.
  page: async ({ page }, provide) => {
    await setEnglishLocale(page);
    await provide(page);
  },
  loginAs: async ({ page }, provide) => {
    await provide((user) => signIn(page, user));
  },
});

export { expect };
