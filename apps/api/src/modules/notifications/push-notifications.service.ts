import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: "default";
};

type ExpoPushTicket = {
  status: "ok" | "error";
  details?: { error?: string };
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Registers Expo push tokens and fans out push notifications through
 * Expo's push service. Every failure is swallowed and logged: a push
 * send must never fail the request that triggered it.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async registerToken(userId: string, token: string, platform: string) {
    const prisma = this.prisma as any;
    await prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async unregisterToken(userId: string, token: string) {
    const prisma = this.prisma as any;
    await prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  async notifyUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const prisma = this.prisma as any;
      const tokens: { token: string }[] = await prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      });

      if (tokens.length === 0) {
        return;
      }

      await this.sendExpoPush(
        tokens.map((row) => row.token),
        payload,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "push_notification_failed",
          reason: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }

  private async sendExpoPush(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;

    for (const tokenChunk of chunk(tokens, EXPO_PUSH_CHUNK_SIZE)) {
      const messages: ExpoPushMessage[] = tokenChunk.map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: "default",
      }));

      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });

        const result = (await response.json().catch(() => null)) as {
          data?: ExpoPushTicket[];
        } | null;

        await this.removeDeadTokens(tokenChunk, result?.data);
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: "push_notification_send_failed",
            reason: error instanceof Error ? error.message : "unknown",
          }),
        );
      }
    }
  }

  private async removeDeadTokens(
    tokens: string[],
    tickets: ExpoPushTicket[] | undefined,
  ): Promise<void> {
    if (!tickets) {
      return;
    }

    const prisma = this.prisma as any;
    const deadTokens = tickets
      .map((ticket, index) =>
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
          ? tokens[index]
          : null,
      )
      .filter((token): token is string => Boolean(token));

    if (deadTokens.length === 0) {
      return;
    }

    await prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
  }
}
