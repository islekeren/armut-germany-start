import { Injectable, NotFoundException, ForbiddenException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

type NotificationOperation =
  | "quote_accepted"
  | "quote_received"
  | "request_cancelled"
  | "booking_completion_message"
  | "booking_completion_pending"
  | "booking_completed"
  | "booking_cancelled";

type NotificationPayload = {
  type: NotificationOperation;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /** Use only for notification side effects after the primary mutation succeeds. */
  async bestEffort(
    operation: NotificationOperation,
    task: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await task();
    } catch {
      this.logger.warn(JSON.stringify({ event: "notification_failed", operation }));
    }
  }

  async createBestEffort(userId: string, payload: NotificationPayload): Promise<void> {
    await this.bestEffort(payload.type, () => this.create(userId, payload));
  }

  async create(
    userId: string,
    payload: {
      type: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const prisma = this.prisma as any;
    return prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ?? undefined,
      },
    });
  }

  async list(userId: string, onlyUnread?: boolean, limit = 100) {
    const prisma = this.prisma as any;
    return prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async getUnreadCount(userId: string) {
    const prisma = this.prisma as any;
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const prisma = this.prisma as any;
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this notification");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    const prisma = this.prisma as any;
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updated: result.count };
  }
}
