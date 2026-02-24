import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MessagesService } from "./messages.service";

describe("MessagesService", () => {
  const prisma = {
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: MessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(prisma as any);
  });

  it("returns existing conversation when already present", async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: "c1" });

    await expect(
      service.createConversation("u1", { participantId: "u2" } as any)
    ).resolves.toEqual({ id: "c1" });
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it("creates conversation when missing", async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ id: "c2" });

    await expect(
      service.createConversation("u1", { participantId: "u2", requestId: "r1" } as any)
    ).resolves.toEqual({ id: "c2" });
    expect(prisma.conversation.create).toHaveBeenCalledTimes(1);
  });

  it("returns conversations with unread count and other participant", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "c1",
        participants: [
          { userId: "u1", user: { id: "u1", firstName: "A" } },
          { userId: "u2", user: { id: "u2", firstName: "B" } },
        ],
      },
    ]);
    prisma.message.count.mockResolvedValue(3);

    await expect(service.getConversations("u1")).resolves.toEqual([
      expect.objectContaining({
        id: "c1",
        unreadCount: 3,
        otherParticipant: { id: "u2", firstName: "B" },
      }),
    ]);
  });

  it("gets one conversation and validates participation", async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "c1",
        participants: [{ userId: "u2", user: { id: "u2" } }],
      })
      .mockResolvedValueOnce({
        id: "c1",
        participants: [
          { userId: "u1", user: { id: "u1" } },
          { userId: "u2", user: { id: "u2" } },
        ],
      });

    await expect(service.getConversation("missing", "u1")).rejects.toThrow(
      NotFoundException
    );
    await expect(service.getConversation("c1", "u1")).rejects.toThrow(
      ForbiddenException
    );
    await expect(service.getConversation("c1", "u1")).resolves.toEqual(
      expect.objectContaining({
        id: "c1",
        otherParticipant: { id: "u2" },
      })
    );
  });

  it("gets paginated messages and returns chronological order", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "c1",
      participants: [{ userId: "u1" }],
    });
    prisma.message.findMany.mockResolvedValue([
      { id: "m2", createdAt: new Date("2026-02-02") },
      { id: "m1", createdAt: new Date("2026-02-01") },
    ]);
    prisma.message.count.mockResolvedValue(2);

    const result = await service.getMessages("c1", "u1", 1, 2);
    expect(result).toEqual({
      data: [
        { id: "m1", createdAt: new Date("2026-02-01") },
        { id: "m2", createdAt: new Date("2026-02-02") },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 2,
        totalPages: 1,
      },
    });
  });

  it("throws when getting messages without conversation access", async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "c1", participants: [{ userId: "u2" }] });

    await expect(service.getMessages("c1", "u1")).rejects.toThrow(NotFoundException);
    await expect(service.getMessages("c1", "u1")).rejects.toThrow(ForbiddenException);
  });

  it("sends a message through transaction", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "c1",
      participants: [{ userId: "u1" }],
    });
    prisma.message.create.mockReturnValue("create-op" as any);
    prisma.conversation.update.mockReturnValue("update-op" as any);
    prisma.$transaction.mockResolvedValue([{ id: "m1", content: "hi" }]);

    await expect(
      service.sendMessage("u1", { conversationId: "c1", content: "hi" } as any)
    ).resolves.toEqual({ id: "m1", content: "hi" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("marks messages as read and validates participation", async () => {
    prisma.conversation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "c1", participants: [{ userId: "u2" }] })
      .mockResolvedValueOnce({ id: "c1", participants: [{ userId: "u1" }] });
    prisma.message.updateMany.mockResolvedValue({ count: 3 });

    await expect(service.markAsRead("c1", "u1")).rejects.toThrow(NotFoundException);
    await expect(service.markAsRead("c1", "u1")).rejects.toThrow(ForbiddenException);
    await expect(service.markAsRead("c1", "u1")).resolves.toEqual({
      success: true,
    });
  });

  it("returns unread count", async () => {
    prisma.message.count.mockResolvedValue(7);
    await expect(service.getUnreadCount("u1")).resolves.toEqual({ unreadCount: 7 });
  });
});
