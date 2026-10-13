import { ConfigService } from "@nestjs/config";
import { mkdtemp, readdir, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecoveryEmailService } from "./recovery-email.service";

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe("RecoveryEmailService", () => {
  it("captures private local mail without sending it externally", async () => {
    const directory = await mkdtemp(join(tmpdir(), "arm-mail-"));
    try {
      const service = new RecoveryEmailService(config({ NODE_ENV: "test", EMAIL_TRANSPORT: "local", EMAIL_LOCAL_DIR: directory, FRONTEND_URL: "http://localhost:3000" }));
      await service.sendReset("test@example.com", "a".repeat(43), "en");
      const files = await readdir(directory);
      expect(files).toHaveLength(1);
      const file = join(directory, files[0]);
      const message = await readFile(file, "utf8");
      expect(message).toContain("Reset your password");
      expect(message).toContain("#token=");
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("keeps secrets in URL fragments, never query parameters", () => {
    const service = new RecoveryEmailService(config({ NODE_ENV: "test", EMAIL_TRANSPORT: "local" }));
    const url = new URL(service.resetUrl("secret", "de"));
    expect(url.search).toBe("");
    expect(url.hash).toBe("#token=secret&locale=de");
  });

  it.each(["production", "staging", ""]) ("rejects local email outside development/test (%s)", runtime => {
    expect(() => new RecoveryEmailService(config({ NODE_ENV: runtime, EMAIL_TRANSPORT: "local" }))).toThrow(/Local email/);
  });

  it("requires explicit SMTP sender and host", () => {
    expect(() => new RecoveryEmailService(config({ NODE_ENV: "test", EMAIL_TRANSPORT: "smtp" }))).toThrow(/SMTP_HOST/);
  });

  it("is disabled by default without an invented sender", () => {
    const service = new RecoveryEmailService(config({ NODE_ENV: "production" }));
    expect(service.enabled).toBe(false);
  });
});
