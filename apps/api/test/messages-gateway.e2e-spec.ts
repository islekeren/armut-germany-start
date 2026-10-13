import { type INestApplication } from "@nestjs/common";
import { io, type Socket } from "socket.io-client";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import {
  closeTestApp,
  createConversationFixture,
  createTestApp,
  createUserFixture,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

const EVENT_TIMEOUT_MS = 3000;

function waitFor<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      EVENT_TIMEOUT_MS,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves true if `event` arrives within `ms`, false otherwise. */
function receivesWithin(
  socket: Socket,
  event: string,
  ms = 400,
): Promise<boolean> {
  return new Promise((resolve) => {
    const handler = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(false);
    }, ms);
    socket.once(event, handler);
  });
}

describe("Messages gateway (e2e)", () => {
  let app: INestApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];

  let aliceId: string;
  let bobId: string;
  let aliceToken: string;
  let bobToken: string;
  let malloryToken: string;
  let conversationId: string;

  beforeAll(async () => {
    // The gateway logs every connect/disconnect and auth failure.
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    app = await createTestApp();
    await app.listen(0, "127.0.0.1");
    baseUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
    aliceId = (await createUserFixture({ email: "alice@example.com" })).user.id;
    bobId = (await createUserFixture({ email: "bob@example.com" })).user.id;
    await createUserFixture({ email: "mallory@example.com" });
    aliceToken = (await loginAs(app, "alice@example.com")).accessToken;
    bobToken = (await loginAs(app, "bob@example.com")).accessToken;
    malloryToken = (await loginAs(app, "mallory@example.com")).accessToken;
    conversationId = (
      await createConversationFixture({ participantIds: [aliceId, bobId] })
    ).id;
  });

  afterEach(() => {
    while (sockets.length) {
      sockets.pop()!.disconnect();
    }
  });

  afterAll(async () => {
    await closeTestApp(app);
    jest.restoreAllMocks();
  });

  function connect(auth: Record<string, string> = {}): Socket {
    const socket = io(`${baseUrl}/messages`, {
      auth,
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  }

  async function connectAs(token: string): Promise<Socket> {
    const socket = connect({ token });
    await waitFor(socket, "connect");
    return socket;
  }

  async function join(socket: Socket, id = conversationId) {
    return socket.emitWithAck("joinConversation", id);
  }

  describe("connection auth", () => {
    it("rejects browser handshakes from an origin outside the HTTP allowlist", async () => {
      const socket = io(`${baseUrl}/messages`, {
        auth: { token: aliceToken }, transports: ["websocket"],
        forceNew: true, reconnection: false,
        extraHeaders: { Origin: "https://untrusted.invalid" },
      });
      sockets.push(socket);
      expect(await waitFor<Error>(socket, "connect_error")).toBeInstanceOf(Error);
    });

    it("handles authorized socket events when the HTTP throttle bypass is off", async () => {
      const previous = process.env.THROTTLE_DISABLED;
      process.env.THROTTLE_DISABLED = "false";
      try {
        const socket = await connectAs(aliceToken);
        expect(await socket.timeout(EVENT_TIMEOUT_MS).emitWithAck("markAsRead", conversationId))
          .toEqual({ success: true });
      } finally {
        process.env.THROTTLE_DISABLED = previous;
      }
    });
    it("rejects an unexpired JWT after account deletion", async () => {
      await request(app.getHttpServer()).delete("/api/users/profile")
        .set("Authorization", `Bearer ${aliceToken}`).expect(200);
      const socket = connect({ token: aliceToken });
      expect(await waitFor<string>(socket, "disconnect")).toBe("io server disconnect");
    });

    it("evicts existing room membership immediately on account deletion", async () => {
      const alice = await connectAs(aliceToken);
      await join(alice);
      const disconnected = waitFor<string>(alice, "disconnect");
      await request(app.getHttpServer()).delete("/api/users/profile")
        .set("Authorization", `Bearer ${aliceToken}`).expect(200);
      expect(await disconnected).toBe("io server disconnect");
    });

    it("disconnects an idle socket when its access token expires", async () => {
      const jwt = new JwtService({ secret: process.env.JWT_SECRET });
      const token = jwt.sign({ sub: aliceId }, { expiresIn: 2 });
      const socket = await connectAs(token);
      expect(await waitFor<string>(socket, "disconnect")).toBe("io server disconnect");
    });

    it("rechecks account state before a socket mutation", async () => {
      const alice = await connectAs(aliceToken);
      await join(alice);
      await prisma.user.update({ where: { id: aliceId }, data: { deletedAt: new Date() } });
      const disconnected = waitFor<string>(alice, "disconnect");
      alice.emit("sendMessage", { conversationId, content: "revoked sender" });
      expect(await disconnected).toBe("io server disconnect");
      expect(await prisma.message.count()).toBe(0);
    });
    it("disconnects clients without a token or with an invalid one", async () => {
      for (const auth of [{}, { token: "not.a.jwt" }]) {
        const socket = connect(auth);
        const reason = await waitFor<string>(socket, "disconnect");
        expect(reason).toBe("io server disconnect");
      }
    });

    it("accepts a bearer token in the Authorization header too", async () => {
      const socket = io(`${baseUrl}/messages`, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        extraHeaders: { Authorization: `Bearer ${aliceToken}` },
      });
      sockets.push(socket);
      await waitFor(socket, "connect");

      await expect(join(socket)).resolves.toEqual({ success: true });
    });
  });

  describe("conversation rooms", () => {
    it("does not deliver to an account revoked outside this gateway process", async () => {
      const alice = await connectAs(aliceToken);
      const bob = await connectAs(bobToken);
      await join(alice);
      await join(bob);
      await prisma.user.update({ where: { id: aliceId }, data: { deletedAt: new Date() } });
      const delivered = receivesWithin(alice, "newMessage");
      const ack = await bob.emitWithAck("sendMessage", { conversationId, content: "active recipient only" });
      expect(ack.success).toBe(true);
      expect(await delivered).toBe(false);
    });

    it("limits socket events per account across connections", async () => {
      const alice = await connectAs(aliceToken);
      for (let i = 0; i < 100; i += 1) {
        expect(await alice.emitWithAck("markAsRead", conversationId)).toEqual({ success: true });
      }
      const otherTab = await connectAs(aliceToken);
      expect(await otherTab.emitWithAck("markAsRead", conversationId)).toEqual({
        success: false, error: "Too many socket events. Try again later.",
      });
    });
    it("only lets participants join", async () => {
      const alice = await connectAs(aliceToken);
      const mallory = await connectAs(malloryToken);

      await expect(join(alice)).resolves.toEqual({ success: true });
      await expect(join(mallory)).resolves.toEqual({
        success: false,
        error: "Access denied",
      });
    });

    it("broadcasts new messages to the room and notifies the other participant", async () => {
      const alice = await connectAs(aliceToken);
      const bob = await connectAs(bobToken);
      const mallory = await connectAs(malloryToken);
      await join(alice);
      await join(bob);
      await join(mallory); // denied, so must not receive anything

      const bobGetsMessage = waitFor<{ content: string }>(bob, "newMessage");
      const bobGetsNotification = waitFor<{ conversationId: string }>(
        bob,
        "messageNotification",
      );
      const aliceEcho = waitFor<{ content: string }>(alice, "newMessage");
      const malloryHearsAnything = receivesWithin(mallory, "newMessage");
      const aliceNotified = receivesWithin(alice, "messageNotification");

      const ack = await alice.emitWithAck("sendMessage", {
        conversationId,
        content: "Hello over websockets",
      });

      expect(ack).toMatchObject({
        success: true,
        message: { content: "Hello over websockets", senderId: aliceId },
      });
      expect((await bobGetsMessage).content).toBe("Hello over websockets");
      expect((await aliceEcho).content).toBe("Hello over websockets");
      expect((await bobGetsNotification).conversationId).toBe(conversationId);
      expect(await malloryHearsAnything).toBe(false);
      expect(await aliceNotified).toBe(false);

      expect(await prisma.message.count({ where: { conversationId } })).toBe(1);
    });

    it("sends the notification to a participant who has not joined the room", async () => {
      const alice = await connectAs(aliceToken);
      const bob = await connectAs(bobToken);
      await join(alice);

      const bobNotified = waitFor<{ message: { content: string } }>(
        bob,
        "messageNotification",
      );
      await alice.emitWithAck("sendMessage", {
        conversationId,
        content: "ping",
      });

      expect((await bobNotified).message.content).toBe("ping");
    });

    it("refuses sends from non-participants", async () => {
      const mallory = await connectAs(malloryToken);

      const ack = await mallory.emitWithAck("sendMessage", {
        conversationId,
        content: "injected",
      });

      expect(ack).toEqual({
        success: false,
        error: "Not a participant of this conversation",
      });
      expect(await prisma.message.count()).toBe(0);
    });

    it("survives a payload the global ValidationPipe rejects instead of crashing the socket", async () => {
      const alice = await connectAs(aliceToken);
      await join(alice);

      const validationFailure = waitFor(alice, "exception");
      alice.emit("sendMessage", { conversationId });
      await expect(validationFailure).resolves.toBeTruthy();

      // The connection, and the gateway process, must still work afterwards.
      const ack = await alice.emitWithAck("sendMessage", {
        conversationId,
        content: "still alive",
      });
      expect(ack).toMatchObject({ success: true });
    });

    it("stops delivering after leaveConversation", async () => {
      const alice = await connectAs(aliceToken);
      const bob = await connectAs(bobToken);
      await join(alice);
      await join(bob);
      await expect(
        bob.emitWithAck("leaveConversation", conversationId),
      ).resolves.toEqual({
        success: true,
      });

      const bobHearsRoom = receivesWithin(bob, "newMessage");
      await alice.emitWithAck("sendMessage", {
        conversationId,
        content: "after leave",
      });

      expect(await bobHearsRoom).toBe(false);
    });
  });

  describe("read receipts and typing", () => {
    it("does not let an outsider inject typing into a conversation", async () => {
      const bob = await connectAs(bobToken);
      await join(bob);
      const mallory = await connectAs(malloryToken);
      const delivered = receivesWithin(bob, "userTyping");
      mallory.emit("typing", { conversationId, isTyping: true });
      expect(await delivered).toBe(false);
    });
    it("marks messages read and tells the room", async () => {
      await prisma.message.create({
        data: {
          conversationId,
          senderId: aliceId,
          content: "unread",
          attachments: [],
        },
      });
      const alice = await connectAs(aliceToken);
      const bob = await connectAs(bobToken);
      await join(alice);
      await join(bob);

      const aliceSeesRead = waitFor<{ conversationId: string; readBy: string }>(
        alice,
        "messagesRead",
      );
      await expect(
        bob.emitWithAck("markAsRead", conversationId),
      ).resolves.toEqual({
        success: true,
      });

      expect(await aliceSeesRead).toMatchObject({
        conversationId,
        readBy: bobId,
      });
      expect(
        await prisma.message.count({ where: { conversationId, readAt: null } }),
      ).toBe(0);
    });

    it("relays typing indicators to the other participants only", async () => {
      const alice = await connectAs(aliceToken);
      const bob = await connectAs(bobToken);
      await join(alice);
      await join(bob);

      const bobSeesTyping = waitFor<{ userId: string; isTyping: boolean }>(
        bob,
        "userTyping",
      );
      const aliceSeesOwnTyping = receivesWithin(alice, "userTyping");
      alice.emit("typing", { conversationId, isTyping: true });

      expect(await bobSeesTyping).toEqual({ userId: aliceId, isTyping: true });
      expect(await aliceSeesOwnTyping).toBe(false);
    });
  });
});
