import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createConversationFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

describe("Messages REST (e2e)", () => {
  let app: INestApplication;
  let aliceId: string;
  let bobId: string;
  let aliceToken: string;
  let bobToken: string;
  let malloryToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
    aliceId = (await createUserFixture({ email: "alice@example.com" })).user.id;
    bobId = (await createUserFixture({ email: "bob@example.com" })).user.id;
    await createUserFixture({ email: "mallory@example.com" });
    aliceToken = (await loginAs(app, "alice@example.com")).accessToken;
    bobToken = (await loginAs(app, "bob@example.com")).accessToken;
    malloryToken = (await loginAs(app, "mallory@example.com")).accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());

  describe("POST /api/messages/conversations", () => {
    it("creates a conversation once and returns the existing one afterwards", async () => {
      const first = await api()
        .post("/api/messages/conversations")
        .set(bearer(aliceToken))
        .send({ participantId: bobId })
        .expect(201);

      expect(
        first.body.participants.map((p: { userId: string }) => p.userId).sort(),
      ).toEqual([aliceId, bobId].sort());

      // Same pair, either direction: no duplicate.
      const again = await api()
        .post("/api/messages/conversations")
        .set(bearer(bobToken))
        .send({ participantId: aliceId })
        .expect(201);
      expect(again.body.id).toBe(first.body.id);
      expect(await prisma.conversation.count()).toBe(1);
    });

    it("keeps request-scoped conversations separate", async () => {
      const serviceRequest = await createRequestFixture({
        customerId: aliceId,
      });

      const general = await api()
        .post("/api/messages/conversations")
        .set(bearer(bobToken))
        .send({ participantId: aliceId })
        .expect(201);
      const scoped = await api()
        .post("/api/messages/conversations")
        .set(bearer(bobToken))
        .send({ participantId: aliceId, requestId: serviceRequest.id })
        .expect(201);

      expect(scoped.body.requestId).toBe(serviceRequest.id);
      expect(scoped.body.id).not.toBe(general.body.id);
    });

    it("rejects self-conversations, unknown users, deleted users, and unknown requests", async () => {
      const create = (body: object) =>
        api()
          .post("/api/messages/conversations")
          .set(bearer(aliceToken))
          .send(body);

      await create({ participantId: aliceId }).expect(400);
      await create({ participantId: UNKNOWN_ID }).expect(404);
      await create({ participantId: bobId, requestId: UNKNOWN_ID }).expect(404);
      await create({}).expect(400);

      await api()
        .delete("/api/users/profile")
        .set(bearer(bobToken))
        .expect(200);
      await create({ participantId: bobId }).expect(404);
      expect(await prisma.conversation.count()).toBe(0);
    });
  });

  describe("sending and reading", () => {
    it("delivers messages, tracks unread counts, and marks them read", async () => {
      const conversation = await createConversationFixture({
        participantIds: [aliceId, bobId],
      });

      for (const content of ["Hi Bob", "Are you free Saturday?"]) {
        await api()
          .post("/api/messages/send")
          .set(bearer(aliceToken))
          .send({ conversationId: conversation.id, content })
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({ content, senderId: aliceId });
          });
      }

      await api()
        .get("/api/messages/unread-count")
        .set(bearer(bobToken))
        .expect(200, { unreadCount: 2 });
      // Your own messages never count as unread.
      await api()
        .get("/api/messages/unread-count")
        .set(bearer(aliceToken))
        .expect(200, { unreadCount: 0 });

      const list = await api()
        .get("/api/messages/conversations")
        .set(bearer(bobToken))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        id: conversation.id,
        unreadCount: 2,
        otherParticipant: { id: aliceId },
      });
      expect(list.body[0].messages[0].content).toBe("Are you free Saturday?");

      await api()
        .post("/api/messages/read")
        .set(bearer(bobToken))
        .send({ conversationId: conversation.id })
        .expect(201, { success: true });
      await api()
        .get("/api/messages/unread-count")
        .set(bearer(bobToken))
        .expect(200, { unreadCount: 0 });
    });

    it("returns history in chronological order with pagination", async () => {
      const conversation = await createConversationFixture({
        participantIds: [aliceId, bobId],
      });
      for (let i = 1; i <= 5; i += 1) {
        await api()
          .post("/api/messages/send")
          .set(bearer(i % 2 ? aliceToken : bobToken))
          .send({ conversationId: conversation.id, content: `message ${i}` })
          .expect(201);
      }

      const latest = await api()
        .get(`/api/messages/conversations/${conversation.id}/messages?limit=2`)
        .set(bearer(aliceToken))
        .expect(200);
      expect(
        latest.body.data.map((m: { content: string }) => m.content),
      ).toEqual(["message 4", "message 5"]);
      expect(latest.body.meta).toMatchObject({
        total: 5,
        page: 1,
        limit: 2,
        totalPages: 3,
      });

      const older = await api()
        .get(
          `/api/messages/conversations/${conversation.id}/messages?limit=2&page=2`,
        )
        .set(bearer(aliceToken))
        .expect(200);
      expect(
        older.body.data.map((m: { content: string }) => m.content),
      ).toEqual(["message 2", "message 3"]);
    });

    it("moves the most recently active conversation to the top", async () => {
      const carolId = (await createUserFixture({ email: "carol@example.com" }))
        .user.id;
      const withBob = await createConversationFixture({
        participantIds: [aliceId, bobId],
      });
      const withCarol = await createConversationFixture({
        participantIds: [aliceId, carolId],
      });

      await api()
        .post("/api/messages/send")
        .set(bearer(aliceToken))
        .send({ conversationId: withBob.id, content: "bump" })
        .expect(201);

      const list = await api()
        .get("/api/messages/conversations")
        .set(bearer(aliceToken))
        .expect(200);
      expect(list.body.map((c: { id: string }) => c.id)).toEqual([
        withBob.id,
        withCarol.id,
      ]);
    });
  });

  describe("participant checks", () => {
    it("locks non-participants out of every conversation endpoint", async () => {
      const conversation = await createConversationFixture({
        participantIds: [aliceId, bobId],
        messages: [{ senderId: aliceId, content: "private" }],
      });

      await api()
        .get(`/api/messages/conversations/${conversation.id}`)
        .set(bearer(malloryToken))
        .expect(403);
      await api()
        .get(`/api/messages/conversations/${conversation.id}/messages`)
        .set(bearer(malloryToken))
        .expect(403);
      await api()
        .post("/api/messages/send")
        .set(bearer(malloryToken))
        .send({ conversationId: conversation.id, content: "let me in" })
        .expect(403);
      await api()
        .post("/api/messages/read")
        .set(bearer(malloryToken))
        .send({ conversationId: conversation.id })
        .expect(403);

      const malloryList = await api()
        .get("/api/messages/conversations")
        .set(bearer(malloryToken))
        .expect(200);
      expect(malloryList.body).toEqual([]);
      await api()
        .get("/api/messages/unread-count")
        .set(bearer(malloryToken))
        .expect(200, { unreadCount: 0 });

      expect(await prisma.message.count()).toBe(1);
    });

    it("returns 404 for unknown conversations", async () => {
      await api()
        .get(`/api/messages/conversations/${UNKNOWN_ID}`)
        .set(bearer(aliceToken))
        .expect(404);
      await api()
        .post("/api/messages/send")
        .set(bearer(aliceToken))
        .send({ conversationId: UNKNOWN_ID, content: "hello?" })
        .expect(404);
    });

    it("validates the send payload", async () => {
      const conversation = await createConversationFixture({
        participantIds: [aliceId, bobId],
      });
      const send = (body: object) =>
        api().post("/api/messages/send").set(bearer(aliceToken)).send(body);

      await send({ conversationId: conversation.id }).expect(400);
      await send({
        conversationId: conversation.id,
        content: "x",
        attachments: "nope",
      }).expect(400);
      await send({
        conversationId: conversation.id,
        content: "x",
        extra: 1,
      }).expect(400);
    });
  });
});
