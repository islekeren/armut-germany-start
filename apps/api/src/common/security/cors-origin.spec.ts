import { isAllowedOrigin } from "./cors-origin";

describe("HTTP and socket origin allowlist", () => {
  const previous = process.env.CORS_ORIGINS;
  afterEach(() => {
    if (previous === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previous;
  });

  it("matches configured origins literally and anchors wildcard patterns", () => {
    process.env.CORS_ORIGINS = " https://app.example.com,https://preview-*.example.com ";
    expect(isAllowedOrigin("https://app.example.com")).toBe(true);
    expect(isAllowedOrigin("https://preview-123.example.com")).toBe(true);
    expect(isAllowedOrigin("https://appXexample.com")).toBe(false);
    expect(isAllowedOrigin("https://app.example.com.attacker.invalid")).toBe(false);
    expect(isAllowedOrigin("https://preview-123.example.com.attacker.invalid")).toBe(false);
  });

  it("uses local defaults without allowing arbitrary browser origins", () => {
    delete process.env.CORS_ORIGINS;
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://untrusted.invalid")).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(true);
  });
});
