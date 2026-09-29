import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createTestApp,
  createUserFixture,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Notifications (e2e)", () => {
  let app: INestApplication;
  let userId: string;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
    userId = (await createUserFixture({ email: "noti@example.com" })).user.id;
    await createUserFixture({ email: "other@example.com" });
    token = (await loginAs(app, "noti@example.com")).accessToken;
    otherToken = (await loginAs(app, "other@example.com")).accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());

  async function seedNotifications(count: number, isRead = false) {
    const created = [];
    for (let i = 0; i < count; i += 1) {
      created.push(
        await prisma.notification.create({
          data: {
            userId,
            type: "test",
            title: `Notification ${i}`,
            message: "Body",
            isRead,
            createdAt: new Date(Date.now() - (count - i) * 1000),
          },
        }),
      );
    }
    return created;
  }

  it("lists newest first, filters unread, and honours the limit", async () => {
    await seedNotifications(2, true);
    await seedNotifications(3);

    const all = await api()
      .get("/api/notifications")
      .set(bearer(token))
      .expect(200);
    expect(all.body).toHaveLength(5);
    const times = all.body.map((n: { createdAt: string }) =>
      Date.parse(n.createdAt),
    );
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const unread = await api()
      .get("/api/notifications?onlyUnread=true")
      .set(bearer(token))
      .expect(200);
    expect(unread.body).toHaveLength(3);
    expect(unread.body.every((n: { isRead: boolean }) => !n.isRead)).toBe(true);

    const limited = await api()
      .get("/api/notifications?limit=2")
      .set(bearer(token))
      .expect(200);
    expect(limited.body).toHaveLength(2);

    await api()
      .get("/api/notifications/unread-count")
      .set(bearer(token))
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ unreadCount: 3 }));
  });

  it("marks one or all as read", async () => {
    const [first] = await seedNotifications(3);

    await api()
      .post(`/api/notifications/${first.id}/read`)
      .set(bearer(token))
      .expect(201);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: first.id } }))
        .isRead,
    ).toBe(true);

    await api()
      .post("/api/notifications/read-all")
      .set(bearer(token))
      .expect(201);
    expect(
      await prisma.notification.count({ where: { userId, isRead: false } }),
    ).toBe(0);
  });

  it("keeps notifications private to their owner", async () => {
    const [mine] = await seedNotifications(1);

    await api()
      .post(`/api/notifications/${mine.id}/read`)
      .set(bearer(otherToken))
      .expect(403);
    await api()
      .post("/api/notifications/00000000-0000-0000-0000-000000000000/read")
      .set(bearer(token))
      .expect(404);

    const othersList = await api()
      .get("/api/notifications")
      .set(bearer(otherToken))
      .expect(200);
    expect(othersList.body).toEqual([]);

    // read-all from someone else leaves this user's unread count alone.
    await api()
      .post("/api/notifications/read-all")
      .set(bearer(otherToken))
      .expect(201);
    expect(
      await prisma.notification.count({ where: { userId, isRead: false } }),
    ).toBe(1);
  });
});
