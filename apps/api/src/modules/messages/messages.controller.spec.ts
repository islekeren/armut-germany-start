import { MessagesController } from "./messages.controller";

describe("MessagesController", () => {
  const messagesService = {
    createConversation: jest.fn(),
    getConversations: jest.fn(),
    getConversation: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    markAsRead: jest.fn(),
    getUnreadCount: jest.fn(),
  };

  let controller: MessagesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MessagesController(messagesService as any);
  });

  it("creates conversation", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { participantId: "u2" };
    messagesService.createConversation.mockResolvedValue({ id: "c1" });
    await expect(controller.createConversation(req, dto)).resolves.toEqual({
      id: "c1",
    });
    expect(messagesService.createConversation).toHaveBeenCalledWith("u1", dto);
  });

  it("gets conversations", async () => {
    const req = { user: { id: "u1" } };
    messagesService.getConversations.mockResolvedValue([]);
    await expect(controller.getConversations(req)).resolves.toEqual([]);
    expect(messagesService.getConversations).toHaveBeenCalledWith("u1");
  });

  it("gets one conversation", async () => {
    const req = { user: { id: "u1" } };
    messagesService.getConversation.mockResolvedValue({ id: "c1" });
    await expect(controller.getConversation("c1", req)).resolves.toEqual({
      id: "c1",
    });
    expect(messagesService.getConversation).toHaveBeenCalledWith("c1", "u1");
  });

  it("gets messages with defaults", async () => {
    const req = { user: { id: "u1" } };
    messagesService.getMessages.mockResolvedValue({ data: [] });
    await expect(controller.getMessages("c1", req)).resolves.toEqual({ data: [] });
    expect(messagesService.getMessages).toHaveBeenCalledWith("c1", "u1", 1, 50);
  });

  it("gets messages with explicit pagination", async () => {
    const req = { user: { id: "u1" } };
    messagesService.getMessages.mockResolvedValue({ data: [] });
    await controller.getMessages("c1", req, 2, 10);
    expect(messagesService.getMessages).toHaveBeenCalledWith("c1", "u1", 2, 10);
  });

  it("sends message", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { conversationId: "c1", content: "hello" };
    messagesService.sendMessage.mockResolvedValue({ id: "m1" });
    await expect(controller.sendMessage(req, dto)).resolves.toEqual({ id: "m1" });
    expect(messagesService.sendMessage).toHaveBeenCalledWith("u1", dto);
  });

  it("marks conversation as read", async () => {
    const req = { user: { id: "u1" } };
    messagesService.markAsRead.mockResolvedValue({ success: true });
    await expect(
      controller.markAsRead(req, { conversationId: "c1" } as any)
    ).resolves.toEqual({ success: true });
    expect(messagesService.markAsRead).toHaveBeenCalledWith("c1", "u1");
  });

  it("gets unread count", async () => {
    const req = { user: { id: "u1" } };
    messagesService.getUnreadCount.mockResolvedValue({ unreadCount: 3 });
    await expect(controller.getUnreadCount(req)).resolves.toEqual({
      unreadCount: 3,
    });
    expect(messagesService.getUnreadCount).toHaveBeenCalledWith("u1");
  });
});
