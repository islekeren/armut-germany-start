import {
  escapeHtml,
  sanitizeSql,
  sanitizeOutput,
  stripHtml,
  sanitizeFilename,
  sanitizeUrl,
  sanitizePhone,
  sanitizeEmail,
  sanitizeText,
} from "./sanitize.helper";

describe("sanitize.helper", () => {
  it("escapes html entities", () => {
    expect(escapeHtml(`<a href="/x">O'Reilly</a>`)).toBe(
      "&lt;a href=&quot;&#x2F;x&quot;&gt;O&#x27;Reilly&lt;&#x2F;a&gt;"
    );
  });

  it("sanitizes sql-like characters", () => {
    expect(sanitizeSql(`'DROP TABLE users; -- /*x*/`)).toBe(
      "DROP TABLE users  x"
    );
  });

  it("sanitizes output via html escaping", () => {
    expect(sanitizeOutput("<script>alert(1)</script>")).toContain("&lt;script");
  });

  it("strips html tags", () => {
    expect(stripHtml("<p>Hello <b>World</b></p>")).toBe("Hello World");
  });

  it("sanitizes filename and truncates long names", () => {
    const long = `${"a".repeat(300)}.png`;
    const result = sanitizeFilename(`../bad:${long}`);
    expect(result).not.toContain("/");
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it("sanitizes urls and rejects non-http schemes", () => {
    expect(sanitizeUrl("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1"
    );
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeUrl("not-a-url")).toBeNull();
  });

  it("sanitizes phone and email", () => {
    expect(sanitizePhone("+49 (176) 12-34-56")).toBe("+49176123456");
    expect(sanitizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("sanitizes generic text with options", () => {
    expect(
      sanitizeText("   <b>Hello</b> world   ", {
        stripHtml: true,
        maxLength: 5,
      })
    ).toBe("Hello");

    expect(
      sanitizeText("<img src=x onerror=1>", {
        escapeHtml: true,
      })
    ).toContain("&lt;img");
  });

  it("returns empty-like inputs unchanged", () => {
    expect(escapeHtml("")).toBe("");
    expect(sanitizeSql("")).toBe("");
    expect(sanitizeFilename("")).toBe("");
    expect(sanitizePhone("")).toBe("");
    expect(sanitizeEmail("")).toBe("");
    expect(sanitizeText("")).toBe("");
    expect(sanitizeUrl("")).toBeNull();
  });
});
