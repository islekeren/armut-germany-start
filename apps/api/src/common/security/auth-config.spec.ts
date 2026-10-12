import { randomBytes } from "node:crypto";
import { validateAuthConfiguration } from "./auth-config";

describe("authentication environment validation", () => {
  const production = {
    NODE_ENV: "production",
    JWT_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
  };

  it("accepts independent generated production secrets and preserves other config", () => {
    const config = { ...production, PORT: "4000" };
    expect(validateAuthConfiguration(config)).toBe(config);
  });

  it.each([undefined, "", " ", "secret", "test-jwt-secret", "your-super-secret-jwt-key-change-in-production", "replace-with-a-long-random-secret", "x".repeat(64)])(
    "rejects a missing or unsafe production access secret without logging it", (secret) => {
      expect(() => validateAuthConfiguration({ ...production, JWT_SECRET: secret })).toThrow(/JWT_SECRET/);
    },
  );

  it.each([undefined, "", "refresh-secret", "replace-with-a-different-long-random-secret"])(
    "rejects a missing or unsafe refresh secret", (secret) => {
      expect(() => validateAuthConfiguration({ ...production, JWT_REFRESH_SECRET: secret })).toThrow(/JWT_REFRESH_SECRET/);
    },
  );

  it("rejects identical production access and refresh keys", () => {
    expect(() => validateAuthConfiguration({ ...production, JWT_REFRESH_SECRET: production.JWT_SECRET })).toThrow(/different/);
  });

  it.each(["staging", undefined, "preview"])("requires strong secrets in runtime %s", (runtime) => {
    expect(() => validateAuthConfiguration({ ...production, NODE_ENV: runtime, JWT_SECRET: "test-secret" })).toThrow(/JWT_SECRET/);
  });

  it.each(["development", "test"])("allows explicit short keys only in %s", (runtime) => {
    expect(() => validateAuthConfiguration({ NODE_ENV: runtime, JWT_SECRET: "local-access", JWT_REFRESH_SECRET: "local-refresh" })).not.toThrow();
    expect(() => validateAuthConfiguration({ NODE_ENV: runtime })).toThrow(/JWT_SECRET/);
  });

  it("never includes the rejected secret in its error", () => {
    const secret = "test-confidential-value-do-not-log";
    try {
      validateAuthConfiguration({ ...production, JWT_SECRET: secret });
      throw new Error("Expected configuration rejection");
    } catch (error) {
      expect((error as Error).message).toContain("JWT_SECRET");
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
