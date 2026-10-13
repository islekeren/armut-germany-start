import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as nodemailer from "nodemailer";

@Injectable()
export class RecoveryEmailService {
  private readonly mode: string;
  private readonly frontend: URL;
  constructor(private readonly config: ConfigService) {
    this.mode = config.get<string>("EMAIL_TRANSPORT") || "disabled";
    const runtime = config.get<string>("NODE_ENV");
    const local = runtime === "development" || runtime === "test";
    if (!["disabled", "local", "smtp"].includes(this.mode)) throw new Error("Invalid EMAIL_TRANSPORT");
    if (this.mode === "local" && !local) throw new Error("Local email requires development or test runtime");
    const url = config.get<string>("FRONTEND_URL") || (local ? "http://localhost:3000" : "");
    // Disabled recovery can coexist with the current deployment configuration.
    this.frontend = new URL(url || "https://unconfigured.invalid");
    if (this.frontend.username || this.frontend.password ||
        !["http:", "https:"].includes(this.frontend.protocol) ||
        (!local && this.frontend.protocol !== "https:")) throw new Error("Invalid FRONTEND_URL");
    if (this.mode !== "disabled" && !url) throw new Error("FRONTEND_URL is required for email");
    if (this.mode === "smtp" && (!config.get("SMTP_HOST") || !config.get("EMAIL_FROM"))) {
      throw new Error("SMTP_HOST and verified EMAIL_FROM are required for SMTP");
    }
  }

  get enabled() { return this.mode !== "disabled"; }

  resetUrl(token: string, locale: "de" | "en") {
    const url = new URL("/reset-password", this.frontend);
    url.hash = new URLSearchParams({ token, locale }).toString();
    return url.toString();
  }

  async sendReset(to: string, token: string, locale: "de" | "en") {
    if (!this.enabled) return;
    const url = this.resetUrl(token, locale);
    const text = locale === "de"
      ? `Setze dein Passwort zurück: ${url}\n\nDieser Link ist 30 Minuten gültig und kann nur einmal verwendet werden. Falls du dies nicht angefordert hast, ignoriere diese E-Mail.`
      : `Reset your password: ${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email.`;
    const mail = {
      from: this.mode === "local" ? "accounts@localhost.invalid" : this.config.get<string>("EMAIL_FROM"),
      to, subject: locale === "de" ? "Passwort zurücksetzen" : "Reset your password", text,
    };
    if (this.mode === "local") {
      const directory = resolve(this.config.get<string>("EMAIL_LOCAL_DIR") || ".local-mail");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(resolve(directory, `${randomUUID()}.json`), JSON.stringify(mail), { mode: 0o600, flag: "wx" });
      return;
    }
    const user = this.config.get<string>("SMTP_USER");
    const transport = nodemailer.createTransport({
      host: this.config.get<string>("SMTP_HOST"),
      port: Number(this.config.get("SMTP_PORT") || 587),
      secure: this.config.get("SMTP_SECURE") === "true",
      requireTLS: this.config.get("SMTP_SECURE") !== "true",
      auth: user ? { user, pass: this.config.get<string>("SMTP_PASSWORD") } : undefined,
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
      logger: false, debug: false,
    });
    try { await transport.sendMail(mail); } finally { transport.close(); }
  }
}
