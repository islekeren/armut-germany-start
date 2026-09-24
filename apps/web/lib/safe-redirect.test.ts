import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "./safe-redirect";

describe("getSafeRedirect", () => {
  it("keeps same-site paths with query strings", () => {
    expect(getSafeRedirect("/create-request?category=x&draft=1")).toBe(
      "/create-request?category=x&draft=1",
    );
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
  ])("falls back for %p", (value) => {
    expect(getSafeRedirect(value, "/home")).toBe("/home");
  });
});
