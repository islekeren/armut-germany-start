import { NotificationsController } from "./notifications.controller";

describe("NotificationsController", () => {
  const notificationsService = {
    list: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  let controller: NotificationsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationsController(notificationsService as any);
  });

  it("lists notifications for the current user", async () => {
    notificationsService.list.mockResolvedValue([{ id: "n1" }]);

    await expect(
      controller.list({ user: { id: "user-1" } }, "true", "150"),
    ).resolves.toEqual([{ id: "n1" }]);

    expect(notificationsService.list).toHaveBeenCalledWith("user-1", true, 150);
  });

  it("returns unread count and marks notifications as read", async () => {
    notificationsService.getUnreadCount.mockResolvedValue({ unreadCount: 2 });
    notificationsService.markAsRead.mockResolvedValue({ id: "n1", isRead: true });
    notificationsService.markAllAsRead.mockResolvedValue({ updated: 2 });

    await expect(
      controller.unreadCount({ user: { id: "user-1" } }),
    ).resolves.toEqual({ unreadCount: 2 });
    await expect(
      controller.markAsRead({ user: { id: "user-1" } }, "n1"),
    ).resolves.toEqual({ id: "n1", isRead: true });
    await expect(
      controller.markAllAsRead({ user: { id: "user-1" } }),
    ).resolves.toEqual({ updated: 2 });
  });
});
