import request from "supertest";
import {
  closeTestApp,
  createProviderFixture,
  createTestApp,
  createUserFixture,
  loginAs,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Requests, bookings, and notifications (e2e)", () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it("walks a stable request to booking flow and exposes notification endpoints", async () => {
    const { user: customer } = await createUserFixture({
      email: "customer-flow@example.com",
      firstName: "Cora",
      lastName: "Customer",
    });
    const { provider } = await createProviderFixture({
      email: "provider-flow@example.com",
      firstName: "Pat",
      lastName: "Provider",
      categories: ["home-cleaning"],
    });

    const customerAuth = await loginAs(app, "customer-flow@example.com");
    const providerAuth = await loginAs(app, "provider-flow@example.com");

    const createdRequest = await request(app.getHttpServer())
      .post("/api/requests")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .send({
        categoryId: "home-cleaning",
        requestSector: "cleaning-care",
        requestBranch: "home-cleaning",
        title: "Need a move-out cleaning",
        description: "Please deep clean a 2-room apartment before handover.",
        address: "Torstrasse 1",
        city: "Berlin",
        postalCode: "10115",
        lat: 52.52,
        lng: 13.405,
        budgetMin: 120,
        budgetMax: 180,
        images: [],
      })
      .expect(201);

    expect(createdRequest.body.requestSector).toBe("cleaning-care");
    expect(createdRequest.body.requestBranch).toBe("home-cleaning");

    await request(app.getHttpServer())
      .get("/api/providers/me/requests")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: createdRequest.body.id,
              requestBranch: "home-cleaning",
              offerStatus: null,
            }),
          ]),
        );
      });

    const createdQuote = await request(app.getHttpServer())
      .post("/api/quotes")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .send({
        requestId: createdRequest.body.id,
        price: 150,
        message: "I can handle the handover cleaning this week.",
        validUntil: "2026-05-01T12:00:00.000Z",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .expect(200)
      .expect({ unreadCount: 1 });

    await request(app.getHttpServer())
      .get("/api/notifications?onlyUnread=true")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "quote_received",
              metadata: expect.objectContaining({
                requestId: createdRequest.body.id,
                quoteId: createdQuote.body.id,
                providerId: provider.id,
              }),
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(`/api/quotes/${createdQuote.body.id}/respond`)
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .send({ action: "accepted" })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe("accepted");
      });

    const createdBooking = await request(app.getHttpServer())
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .send({
        quoteId: createdQuote.body.id,
        scheduledDate: "2026-04-20T09:00:00.000Z",
      })
      .expect(201);

    expect(createdBooking.body.status).toBe("confirmed");

    await request(app.getHttpServer())
      .patch(`/api/bookings/${createdBooking.body.id}/status`)
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .send({ status: "cancelled" })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe("cancelled");
      });

    const customerNotifications = await request(app.getHttpServer())
      .get("/api/notifications")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .expect(200);

    expect(customerNotifications.body.map((item: any) => item.type)).toEqual(
      expect.arrayContaining(["quote_received", "booking_cancelled"]),
    );

    const providerNotifications = await request(app.getHttpServer())
      .get("/api/notifications")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .expect(200);

    expect(providerNotifications.body.map((item: any) => item.type)).toEqual(
      expect.arrayContaining(["quote_accepted", "booking_cancelled"]),
    );

    await request(app.getHttpServer())
      .get("/api/providers/me/bookings?status=cancelled")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: createdBooking.body.id,
              status: "cancelled",
              customer: `${customer.firstName} ${customer.lastName}`,
            }),
          ]),
        );
      });

    const firstNotificationId = customerNotifications.body[0]?.id;
    expect(firstNotificationId).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post(`/api/notifications/${firstNotificationId}/read`)
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .expect(201)
      .expect((response) => {
        expect(response.body.updated).toBeGreaterThanOrEqual(1);
      });

    await request(app.getHttpServer())
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .expect(200)
      .expect({ unreadCount: 0 });
  });
});
