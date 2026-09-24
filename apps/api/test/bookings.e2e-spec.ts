import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createAdminFixture,
  createDealFixture,
  createProviderFixture,
  createTestApp,
  createUserFixture,
  daysFromNow,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Bookings (e2e)", () => {
  let app: INestApplication;
  let customerId: string;
  let providerId: string;
  let providerUserId: string;
  let customerToken: string;
  let providerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();

    const { user: customer } = await createUserFixture({
      email: "booking-customer@example.com",
    });
    const { provider, user: providerUser } = await createProviderFixture({
      email: "booking-provider@example.com",
    });
    customerId = customer.id;
    providerId = provider.id;
    providerUserId = providerUser.id;
    customerToken = (await loginAs(app, "booking-customer@example.com"))
      .accessToken;
    providerToken = (await loginAs(app, "booking-provider@example.com"))
      .accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());

  const setStatus = (token: string, bookingId: string, status: string) =>
    api()
      .patch(`/api/bookings/${bookingId}/status`)
      .set(bearer(token))
      .send({ status });

  describe("POST /api/bookings", () => {
    it("books an accepted quote as confirmed at the quoted price", async () => {
      const { quote } = await createDealFixture({
        customerId,
        providerId,
        quoteStatus: "accepted",
        requestStatus: "in_progress",
      });

      const response = await api()
        .post("/api/bookings")
        .set(bearer(customerToken))
        .send({ quoteId: quote.id, scheduledDate: daysFromNow(5) })
        .expect(201);

      expect(response.body).toMatchObject({
        quoteId: quote.id,
        customerId,
        providerId,
        status: "confirmed",
        totalPrice: quote.price,
      });
    });

    it("refuses pending quotes, duplicate bookings, past dates, and non-owners", async () => {
      const { quote: pendingQuote } = await createDealFixture({
        customerId,
        providerId,
      });
      const { quote: bookedQuote } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      const { quote: acceptedQuote } = await createDealFixture({
        customerId,
        providerId,
        quoteStatus: "accepted",
      });

      const book = (
        token: string,
        quoteId: string,
        scheduledDate = daysFromNow(5),
      ) =>
        api()
          .post("/api/bookings")
          .set(bearer(token))
          .send({ quoteId, scheduledDate });

      await book(customerToken, pendingQuote.id).expect(400);
      await book(customerToken, bookedQuote.id).expect(400);
      await book(customerToken, acceptedQuote.id, daysFromNow(-1)).expect(400);
      await book(providerToken, acceptedQuote.id).expect(403);
      await book(customerToken, "00000000-0000-0000-0000-000000000000").expect(
        404,
      );
    });
  });

  describe("status transitions", () => {
    it("walks confirmed → in_progress → completion_pending → completed and closes the request", async () => {
      const { booking, serviceRequest } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
        requestStatus: "in_progress",
      });

      await setStatus(providerToken, booking!.id, "in_progress").expect(200);
      await setStatus(providerToken, booking!.id, "completion_pending").expect(
        200,
      );

      expect(
        await prisma.notification.count({
          where: { userId: customerId, type: "booking_completion_pending" },
        }),
      ).toBe(1);

      // Only the customer can confirm completion.
      await setStatus(providerToken, booking!.id, "completed").expect(403);
      const completed = await setStatus(
        customerToken,
        booking!.id,
        "completed",
      ).expect(200);

      expect(completed.body.status).toBe("completed");
      expect(completed.body.completedAt).toBeTruthy();
      expect(
        (
          await prisma.serviceRequest.findUniqueOrThrow({
            where: { id: serviceRequest.id },
          })
        ).status,
      ).toBe("completed");
      expect(
        await prisma.notification.count({
          where: { type: "booking_completed" },
        }),
      ).toBe(2);
    });

    it("rejects transitions outside the state machine", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });

      await setStatus(providerToken, booking!.id, "completed").expect(400);
      await setStatus(providerToken, booking!.id, "pending").expect(400);
      await setStatus(providerToken, booking!.id, "bogus").expect(400);
    });

    it("keeps provider-driven states away from the customer", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });

      await setStatus(customerToken, booking!.id, "in_progress").expect(403);
      await setStatus(customerToken, booking!.id, "completion_pending").expect(
        403,
      );
    });

    it("cancelling reopens the request and retires the quote", async () => {
      const { booking, quote, serviceRequest } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
        requestStatus: "in_progress",
      });

      await setStatus(customerToken, booking!.id, "cancelled").expect(200);

      expect(
        (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } }))
          .status,
      ).toBe("rejected");
      expect(
        (
          await prisma.serviceRequest.findUniqueOrThrow({
            where: { id: serviceRequest.id },
          })
        ).status,
      ).toBe("open");
      const cancelled = await prisma.notification.findMany({
        where: { type: "booking_cancelled" },
      });
      expect(cancelled.map((n) => n.userId).sort()).toEqual(
        [customerId, providerUserId].sort(),
      );

      // Terminal state.
      await setStatus(providerToken, booking!.id, "confirmed").expect(400);
    });

    it("forbids unrelated users from changing status", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      await createUserFixture({ email: "stranger@example.com" });
      const strangerToken = (await loginAs(app, "stranger@example.com"))
        .accessToken;

      await setStatus(strangerToken, booking!.id, "cancelled").expect(403);
    });
  });

  describe("PATCH /api/bookings/:id/reschedule", () => {
    it("moves the date and sends the booking back to pending", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      const newDate = daysFromNow(10);

      const response = await api()
        .patch(`/api/bookings/${booking!.id}/reschedule`)
        .set(bearer(customerToken))
        .send({ scheduledDate: newDate })
        .expect(200);

      expect(response.body.status).toBe("pending");
      expect(new Date(response.body.scheduledDate).toISOString()).toBe(newDate);

      // Provider re-confirms.
      await setStatus(providerToken, booking!.id, "confirmed").expect(200);
    });

    it("refuses providers, past dates, and bookings already underway", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      const { booking: underway } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "in_progress",
      });

      const reschedule = (token: string, id: string, scheduledDate: string) =>
        api()
          .patch(`/api/bookings/${id}/reschedule`)
          .set(bearer(token))
          .send({ scheduledDate });

      await reschedule(providerToken, booking!.id, daysFromNow(4)).expect(403);
      await reschedule(customerToken, booking!.id, daysFromNow(-4)).expect(400);
      await reschedule(customerToken, underway!.id, daysFromNow(4)).expect(400);
    });

    it("validates the new date", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });

      for (const body of [{ scheduledDate: "next tuesday" }, {}]) {
        await api()
          .patch(`/api/bookings/${booking!.id}/reschedule`)
          .set(bearer(customerToken))
          .send(body)
          .expect(400);
      }
    });
  });

  describe("reviews", () => {
    it("lets the customer review a completed booking once and the provider reply", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "completed",
      });

      const review = await api()
        .post(`/api/bookings/${booking!.id}/review`)
        .set(bearer(customerToken))
        .send({
          rating: 4,
          comment: "Solid work.",
          images: [" https://x.test/a.png "],
        })
        .expect(201);

      expect(review.body).toMatchObject({
        rating: 4,
        reviewerId: customerId,
        revieweeId: providerUserId,
        images: ["https://x.test/a.png"],
      });
      expect(
        await prisma.provider.findUniqueOrThrow({ where: { id: providerId } }),
      ).toMatchObject({ ratingAvg: 4, totalReviews: 1 });

      await api()
        .post(`/api/bookings/${booking!.id}/review`)
        .set(bearer(customerToken))
        .send({ rating: 5 })
        .expect(400);

      const reply = await api()
        .post(`/api/bookings/${booking!.id}/reply`)
        .set(bearer(providerToken))
        .send({ reply: "Thank you!" })
        .expect(201);
      expect(reply.body.providerReply).toBe("Thank you!");
    });

    it("guards review and reply rules", async () => {
      const { booking: confirmed } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      const { booking: completed } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "completed",
      });

      await api()
        .post(`/api/bookings/${confirmed!.id}/review`)
        .set(bearer(customerToken))
        .send({ rating: 5 })
        .expect(400);
      await api()
        .post(`/api/bookings/${completed!.id}/review`)
        .set(bearer(providerToken))
        .send({ rating: 5 })
        .expect(403);
      await api()
        .post(`/api/bookings/${completed!.id}/review`)
        .set(bearer(customerToken))
        .send({ rating: 6 })
        .expect(400);
      await api()
        .post(`/api/bookings/${completed!.id}/reply`)
        .set(bearer(providerToken))
        .send({ reply: "Nothing to reply to yet" })
        .expect(400);
      await api()
        .post(`/api/bookings/${completed!.id}/reply`)
        .set(bearer(customerToken))
        .send({ reply: "Not my booking to reply on" })
        .expect(403);
    });
  });

  describe("listing and viewing", () => {
    it("scopes lists to each side and filters by status", async () => {
      await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "completed",
      });

      const customerList = await api()
        .get("/api/bookings/customer")
        .set(bearer(customerToken))
        .expect(200);
      expect(customerList.body.meta.total).toBe(2);

      const providerCompleted = await api()
        .get("/api/bookings/provider?status=completed")
        .set(bearer(providerToken))
        .expect(200);
      expect(providerCompleted.body.data).toHaveLength(1);
      expect(providerCompleted.body.data[0].status).toBe("completed");

      const upcomingCustomer = await api()
        .get("/api/bookings/upcoming/customer")
        .set(bearer(customerToken))
        .expect(200);
      expect(
        upcomingCustomer.body.map((b: { status: string }) => b.status),
      ).toEqual(["confirmed"]);
      await api()
        .get("/api/bookings/upcoming/provider")
        .set(bearer(providerToken))
        .expect(200);
    });

    it("lets participants and admins view a booking but not strangers", async () => {
      const { booking } = await createDealFixture({
        customerId,
        providerId,
        bookingStatus: "confirmed",
      });
      await createUserFixture({ email: "stranger@example.com" });
      await createAdminFixture({ email: "admin@example.com" });
      const strangerToken = (await loginAs(app, "stranger@example.com"))
        .accessToken;
      const adminToken = (await loginAs(app, "admin@example.com")).accessToken;

      for (const token of [customerToken, providerToken, adminToken]) {
        await api()
          .get(`/api/bookings/${booking!.id}`)
          .set(bearer(token))
          .expect(200);
      }
      await api()
        .get(`/api/bookings/${booking!.id}`)
        .set(bearer(strangerToken))
        .expect(403);
      await api()
        .get("/api/bookings/00000000-0000-0000-0000-000000000000")
        .set(bearer(customerToken))
        .expect(404);
    });

    it("returns 404 on the provider list for non-providers", async () => {
      await api()
        .get("/api/bookings/provider")
        .set(bearer(customerToken))
        .expect(404);
    });
  });
});
