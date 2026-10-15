import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { accountEvents } from "../../common/security/account-events";

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, authVersion: number) {
    return this.prisma.authSession.create({
      data: { userId, authVersion, expiresAt: new Date(Date.now() + 7 * 86400_000) },
    });
  }

  async validate(sub: unknown, sid: unknown) {
    if (typeof sub !== "string" || !sub || typeof sid !== "string" || !sid) {
      throw new UnauthorizedException();
    }
    const session = await this.prisma.authSession.findFirst({
      where: { id: sid, userId: sub, revokedAt: null, expiresAt: { gt: new Date() }, user: { deletedAt: null } },
      include: { user: true },
    });
    if (!session || session.authVersion !== session.user.authVersion) {
      throw new UnauthorizedException();
    }
    return session;
  }

  async revoke(userId: string, sid: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sid, userId, revokedAt: null }, data: { revokedAt: new Date() },
    });
    accountEvents.emit("sessionRevoked", userId, sid);
  }
}
