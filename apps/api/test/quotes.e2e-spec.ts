import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createProviderFixture,
  createQuoteFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  daysFromNow,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Quotes (e2e)", () => {
  let app: INestApplication;
  let customerId: string;
  let providerId: string;
  let customerToken: string;
  let providerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();

    const { user: customer } = await createUserFixture({
      email: "quote-customer@example.com",
    });
    const { provider } = await createProviderFixture({
      email: "quote-provider@example.com",
    });
    customerId = customer.id;
    providerId = provider.id;
    customerToken = (await loginAs(app, "quote-customer@example.com"))
      .accessToken;
    providerToken = (await loginAs(app, "quote-provider@example.com"))
      .accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());

  function sendQuote(token: string, requestId: string, overrides = {}) {
    return api()
      .post("/api/quotes")
      .set(bearer(token))
      .send({
        requestId,
        price: 150,
        message: "I can do this on Saturday.",
        validUntil: daysFromNow(7),
        ...overrides,
      });
  }

  describe("POST /api/quotes", () => {
    it("creates a pending quote and notifies the customer", async () => {
      const serviceRequest = await createRequestFixture({ customerId });

      const response = await sendQuote(providerToken, serviceRequest.id).expect(
        201,
      );

      expect(response.body).toMatchObject({
        requestId: serviceRequest.id,
        providerId,
        customerId,
        price: 150,
        status: "pending",
      });

      const notifications = await prisma.notification.findMany({
        where: { userId: customerId, type: "quote_received" },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].metadata).toMatchObject({
        quoteId: response.body.id,
        requestId: serviceRequest.id,
      });
    });

    it("rejects a second quote from the same provider on one request", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      await sendQuote(providerToken, serviceRequest.id).expect(201);

      await sendQuote(providerToken, serviceRequest.id).expect(400);
    });

    it("rejects a validity date in the past", async () => {
      const serviceRequest = await createRequestFixture({ customerId });

      await sendQuote(providerToken, serviceRequest.id, {
        validUntil: daysFromNow(-1),
      }).expect(400);
    });

    it("rejects quotes on requests that are not open", async () => {
      const serviceRequest = await createRequestFixture({
        customerId,
        status: "in_progress",
      });

      await sendQuote(providerToken, serviceRequest.id).expect(400);
    });

    it("returns 404 for an unknown request", async () => {
      await sendQuote(
        providerToken,
        "00000000-0000-0000-0000-000000000000",
      ).expect(404);
    });

    it("forbids customers and unapproved providers from quoting", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      await createProviderFixture({
        email: "pending-provider@example.com",
        companyName: "Pending Co",
        isApproved: false,
      });
      const pendingToken = (await loginAs(app, "pending-provider@example.com"))
        .accessToken;

      await sendQuote(customerToken, serviceRequest.id).expect(403);
      await sendQuote(pendingToken, serviceRequest.id).expect(403);
    });

    it("validates the payload", async () => {
      const serviceRequest = await createRequestFixture({ customerId });

      await sendQuote(providerToken, serviceRequest.id, { price: -5 }).expect(
        400,
      );
      await sendQuote(providerToken, serviceRequest.id, {
        validUntil: "not-a-date",
      }).expect(400);
      await sendQuote(providerToken, serviceRequest.id, {
        unexpected: true,
      }).expect(400);
    });

    it("requires authentication", async () => {
      await api().post("/api/quotes").send({}).expect(401);
    });
  });

  describe("reading quotes", () => {
    it("lists quotes for the provider, the customer, and the request", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });

      const mine = await api()
        .get("/api/quotes/my-quotes")
        .set(bearer(providerToken))
        .expect(200);
      expect(mine.body.map((q: { id: string }) => q.id)).toEqual([quote.id]);

      const received = await api()
        .get("/api/quotes/received")
        .set(bearer(customerToken))
        .expect(200);
      expect(received.body.map((q: { id: string }) => q.id)).toEqual([
        quote.id,
      ]);

      const byRequest = await api()
        .get(`/api/quotes/request/${serviceRequest.id}`)
        .set(bearer(customerToken))
        .expect(200);
      expect(byRequest.body.map((q: { id: string }) => q.id)).toEqual([
        quote.id,
      ]);

      await api()
        .get(`/api/quotes/${quote.id}`)
        .set(bearer(providerToken))
        .expect(200);
      await api()
        .get(`/api/quotes/${quote.id}`)
        .set(bearer(customerToken))
        .expect(200);
    });

    it("hides quotes from unrelated users", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });
      await createUserFixture({ email: "stranger@example.com" });
      await createProviderFixture({
        email: "rival-provider@example.com",
        companyName: "Rival Co",
      });
      const strangerToken = (await loginAs(app, "stranger@example.com"))
        .accessToken;
      const rivalToken = (await loginAs(app, "rival-provider@example.com"))
        .accessToken;

      await api()
        .get(`/api/quotes/${quote.id}`)
        .set(bearer(strangerToken))
        .expect(403);
      await api()
        .get(`/api/quotes/${quote.id}`)
        .set(bearer(rivalToken))
        .expect(403);
      await api()
        .get(`/api/quotes/request/${serviceRequest.id}`)
        .set(bearer(strangerToken))
        .expect(403);

      const rivalQuotes = await api()
        .get("/api/quotes/my-quotes")
        .set(bearer(rivalToken))
        .expect(200);
      expect(rivalQuotes.body).toEqual([]);
    });
  });

  describe("PUT /api/quotes/:id", () => {
    it("lets the owning provider edit a pending quote", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });

      const response = await api()
        .put(`/api/quotes/${quote.id}`)
        .set(bearer(providerToken))
        .send({ price: 175, message: "Updated scope." })
        .expect(200);

      expect(response.body).toMatchObject({
        price: 175,
        message: "Updated scope.",
      });
    });

    it("refuses edits to non-pending quotes, past dates, and other providers", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const accepted = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
        status: "accepted",
      });
      const { provider: rival } = await createProviderFixture({
        email: "rival-provider@example.com",
        companyName: "Rival Co",
      });
      const rivalQuote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId: rival.id,
        customerId,
      });

      await api()
        .put(`/api/quotes/${accepted.id}`)
        .set(bearer(providerToken))
        .send({ price: 10 })
        .expect(400);
      await api()
        .put(`/api/quotes/${rivalQuote.id}`)
        .set(bearer(providerToken))
        .send({ price: 10 })
        .expect(403);

      const rivalToken = (await loginAs(app, "rival-provider@example.com"))
        .accessToken;
      await api()
        .put(`/api/quotes/${rivalQuote.id}`)
        .set(bearer(rivalToken))
        .send({ validUntil: daysFromNow(-2) })
        .expect(400);
    });
  });

  describe("POST /api/quotes/:id/respond", () => {
    it("accepting a quote rejects competitors, moves the request to in_progress, and creates no booking", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const { provider: rival } = await createProviderFixture({
        email: "rival-provider@example.com",
        companyName: "Rival Co",
      });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });
      const competing = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId: rival.id,
        customerId,
      });

      const response = await api()
        .post(`/api/quotes/${quote.id}/respond`)
        .set(bearer(customerToken))
        .send({ action: "accepted" })
        .expect(201);

      expect(response.body.status).toBe("accepted");
      expect(
        (await prisma.quote.findUniqueOrThrow({ where: { id: competing.id } }))
          .status,
      ).toBe("rejected");
      expect(
        (
          await prisma.serviceRequest.findUniqueOrThrow({
            where: { id: serviceRequest.id },
          })
        ).status,
      ).toBe("in_progress");
      // Accepted quotes still need a separate booking-creation step.
      expect(await prisma.booking.count()).toBe(0);

      const providerUserId = (
        await prisma.provider.findUniqueOrThrow({ where: { id: providerId } })
      ).userId;
      expect(
        await prisma.notification.count({
          where: { userId: providerUserId, type: "quote_accepted" },
        }),
      ).toBe(1);
    });

    it("rejecting a quote leaves the request open", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });

      const response = await api()
        .post(`/api/quotes/${quote.id}/respond`)
        .set(bearer(customerToken))
        .send({ action: "rejected" })
        .expect(201);

      expect(response.body.status).toBe("rejected");
      expect(
        (
          await prisma.serviceRequest.findUniqueOrThrow({
            where: { id: serviceRequest.id },
          })
        ).status,
      ).toBe("open");
    });

    it("refuses expired, non-pending, and closed-request quotes", async () => {
      const expiredRequest = await createRequestFixture({ customerId });
      const expired = await createQuoteFixture({
        requestId: expiredRequest.id,
        providerId,
        customerId,
        validUntil: daysFromNow(-1),
      });
      const closedRequest = await createRequestFixture({
        customerId,
        status: "cancelled",
      });
      const onClosed = await createQuoteFixture({
        requestId: closedRequest.id,
        providerId,
        customerId,
      });
      const alreadyRejected = await createQuoteFixture({
        requestId: (await createRequestFixture({ customerId })).id,
        providerId,
        customerId,
        status: "rejected",
      });

      for (const quote of [expired, onClosed, alreadyRejected]) {
        await api()
          .post(`/api/quotes/${quote.id}/respond`)
          .set(bearer(customerToken))
          .send({ action: "accepted" })
          .expect(400);
      }
    });

    it("only lets the request owner respond, with a valid action", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });

      await api()
        .post(`/api/quotes/${quote.id}/respond`)
        .set(bearer(providerToken))
        .send({ action: "accepted" })
        .expect(403);
      await api()
        .post(`/api/quotes/${quote.id}/respond`)
        .set(bearer(customerToken))
        .send({ action: "maybe" })
        .expect(400);
    });
  });

  describe("DELETE /api/quotes/:id", () => {
    it("lets the owning provider withdraw a pending quote only", async () => {
      const serviceRequest = await createRequestFixture({ customerId });
      const pending = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId,
        customerId,
      });
      const accepted = await createQuoteFixture({
        requestId: (await createRequestFixture({ customerId })).id,
        providerId,
        customerId,
        status: "accepted",
      });

      await api()
        .delete(`/api/quotes/${pending.id}`)
        .set(bearer(customerToken))
        .expect(403);
      await api()
        .delete(`/api/quotes/${accepted.id}`)
        .set(bearer(providerToken))
        .expect(400);
      await api()
        .delete(`/api/quotes/${pending.id}`)
        .set(bearer(providerToken))
        .expect(200);

      expect(
        await prisma.quote.findUnique({ where: { id: pending.id } }),
      ).toBeNull();
    });
  });
});
