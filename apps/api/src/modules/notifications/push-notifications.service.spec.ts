import { Logger } from "@nestjs/common";
import { PushNotificationsService } from "./push-notifications.service";

describe("PushNotificationsService", () => {
  const prisma = {
    pushToken: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: PushNotificationsService;
  let fetchMock: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_ACCESS_TOKEN;
    service = new PushNotificationsService(prisma as any);
    fetchMock = jest.spyOn(global, "fetch" as any);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockRestore();
    warn.mockRestore();
  });

  it("upserts a token by its own value, reassigning it to the registering user", async () => {
    await service.registerToken("user-1", "expo-token", "ios");

    expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
      where: { token: "expo-token" },
      create: { userId: "user-1", token: "expo-token", platform: "ios" },
      update: { userId: "user-1", platform: "ios" },
    });
  });

  it("only removes a token that belongs to the requesting user", async () => {
    await service.unregisterToken("user-1", "expo-token");

    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", token: "expo-token" },
    });
  });

  it("does nothing when the user has no registered devices", async () => {
    prisma.pushToken.findMany.mockResolvedValue([]);

    await service.notifyUser("user-1", { title: "Hi", body: "There" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one Expo push request per device and reports the correct body", async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { token: "token-a" },
      { token: "token-b" },
    ]);
    fetchMock.mockResolvedValue({
      json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }),
    });

    await service.notifyUser("user-1", {
      title: "New offer",
      body: "You received a new offer",
      data: { type: "quote_received", requestId: "r1" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(options.body)).toEqual([
      {
        to: "token-a",
        title: "New offer",
        body: "You received a new offer",
        data: { type: "quote_received", requestId: "r1" },
        sound: "default",
      },
      {
        to: "token-b",
        title: "New offer",
        body: "You received a new offer",
        data: { type: "quote_received", requestId: "r1" },
        sound: "default",
      },
    ]);
  });

  it("removes tokens Expo reports as no longer registered", async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { token: "live-token" },
      { token: "dead-token" },
    ]);
    fetchMock.mockResolvedValue({
      json: async () => ({
        data: [
          { status: "ok" },
          { status: "error", details: { error: "DeviceNotRegistered" } },
        ],
      }),
    });

    await service.notifyUser("user-1", { title: "Hi", body: "There" });

    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ["dead-token"] } },
    });
  });

  it("never throws when the user lookup fails", async () => {
    prisma.pushToken.findMany.mockRejectedValue(new Error("db down"));

    await expect(
      service.notifyUser("user-1", { title: "Hi", body: "There" }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("never throws when the Expo request itself fails", async () => {
    prisma.pushToken.findMany.mockResolvedValue([{ token: "token-a" }]);
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      service.notifyUser("user-1", { title: "Hi", body: "There" }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("authenticates with EXPO_ACCESS_TOKEN when configured", async () => {
    process.env.EXPO_ACCESS_TOKEN = "secret-token";
    prisma.pushToken.findMany.mockResolvedValue([{ token: "token-a" }]);
    fetchMock.mockResolvedValue({ json: async () => ({ data: [] }) });

    await service.notifyUser("user-1", { title: "Hi", body: "There" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer secret-token");
  });
});
