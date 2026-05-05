import {
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma as any);
  });

  it("lists notifications with unread filtering and a bounded limit", async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: "n1" }]);

    await expect(service.list("user-1", true, 500)).resolves.toEqual([
      { id: "n1" },
    ]);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  it("returns unread counts", async () => {
    prisma.notification.count.mockResolvedValue(3);

    await expect(service.getUnreadCount("user-1")).resolves.toEqual({
      unreadCount: 3,
    });
  });

  it("marks single notifications as read with ownership checks", async () => {
    prisma.notification.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "n1", userId: "other-user" })
      .mockResolvedValueOnce({ id: "n1", userId: "user-1" });
    prisma.notification.update.mockResolvedValue({ id: "n1", isRead: true });

    await expect(service.markAsRead("user-1", "n1")).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.markAsRead("user-1", "n1")).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.markAsRead("user-1", "n1")).resolves.toEqual({
      id: "n1",
      isRead: true,
    });
  });

  it("marks all unread notifications as read", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });

    await expect(service.markAllAsRead("user-1")).resolves.toEqual({
      updated: 4,
    });
  });
});
