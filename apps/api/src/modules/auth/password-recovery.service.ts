import { BadRequestException, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../common/prisma/prisma.service";
import { accountEvents } from "../../common/security/account-events";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/auth.dto";
import { RecoveryEmailService } from "./recovery-email.service";

const GENERIC_RESPONSE = { message: "If an account exists, a password reset email will be sent." };
// Existing accounts do extra DB work (cooldown update + token insert) that unknown
// addresses skip; floor the response time so that difference can't be timed.
const FORGOT_PASSWORD_FLOOR_MS = 200;
const invalidReset = () => new BadRequestException("Invalid or expired reset link");
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class PasswordRecoveryService implements OnModuleDestroy {
  private readonly deliveries = new Set<Promise<void>>();
  private readonly logger = new Logger(PasswordRecoveryService.name);
  constructor(private readonly prisma: PrismaService, private readonly email: RecoveryEmailService) {}

  async forgotPassword(dto: ForgotPasswordDto) {
    // One policy for all addresses; disabled delivery never persists an unusable token.
    if (!this.email.enabled) return GENERIC_RESPONSE;
    const startedAt = Date.now();
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    try {
      const recipient = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({ where: { email: dto.email, deletedAt: null } });
        if (!user) return null;
        const reserved = await tx.user.updateMany({
          where: {
            id: user.id, deletedAt: null, authVersion: user.authVersion,
            OR: [{ passwordResetRequestedAt: null }, { passwordResetRequestedAt: { lte: new Date(now.getTime() - 60_000) } }],
          }, data: { passwordResetRequestedAt: now },
        });
        if (reserved.count !== 1) return null;
        await tx.passwordResetToken.create({ data: {
          userId: user.id, authVersion: user.authVersion,
          tokenHash: digest(token), expiresAt: new Date(now.getTime() + 30 * 60_000),
        } });
        return user.email;
      });
      if (recipient) {
        // SMTP latency must never turn a generic response into an account oracle.
        // Keep bounded delivery tasks tracked so graceful shutdown can drain them.
        const delivery = this.email.sendReset(recipient, token, dto.locale || "de")
          .catch(() => { this.logger.warn("Password recovery email could not be delivered"); });
        this.deliveries.add(delivery);
        void delivery.finally(() => this.deliveries.delete(delivery));
      }
    } catch {
      // Never log exceptions: SMTP errors may contain recipients or raw message bodies.
      this.logger.warn("Password recovery request could not be completed");
    }
    const remaining = FORGOT_PASSWORD_FLOOR_MS - (Date.now() - startedAt);
    if (remaining > 0) await sleep(remaining);
    return GENERIC_RESPONSE;
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.deliveries);
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(dto.token)) throw invalidReset();
    const tokenHash = digest(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.consumedAt || record.expiresAt <= new Date()) throw invalidReset();
    const password = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      // Lock the account before consuming any token. Every password mutation uses
      // this order, so concurrent sibling-token resets cannot deadlock or win twice.
      const updated = await tx.user.updateMany({
        where: { id: record.userId, deletedAt: null, authVersion: record.authVersion },
        data: { password, authVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw invalidReset();
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw invalidReset(); // rolls back password + version
      await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    });
    accountEvents.emit("sessionsRevoked", record.userId);
    return { message: "Password reset successfully" };
  }
}
