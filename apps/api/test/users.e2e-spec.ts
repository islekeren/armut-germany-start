import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createAdminFixture,
  createDealFixture,
  createProviderFixture,
  createQuoteFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  loginAs,
  prisma,
  resetAndSeedDatabase,
  TEST_PASSWORD,
} from "./e2e-utils";

describe("Users (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());

  describe("profile", () => {
    it("returns the profile without secrets and applies whitelisted updates", async () => {
      await createUserFixture({
        email: "casey@example.com",
        firstName: "Casey",
      });
      const { accessToken } = await loginAs(app, "casey@example.com");

      const profile = await api()
        .get("/api/users/profile")
        .set(bearer(accessToken))
        .expect(200);
      expect(profile.body).toMatchObject({
        email: "casey@example.com",
        firstName: "Casey",
      });
      expect(profile.body).not.toHaveProperty("password");
      expect(profile.body).not.toHaveProperty("deletedAt");

      const updated = await api()
        .put("/api/users/profile")
        .set(bearer(accessToken))
        .send({
          firstName: "Cassie",
          phone: "+49 30 1234567",
          profileImage: "https://cdn.example.com/me.png",
        })
        .expect(200);
      expect(updated.body).toMatchObject({
        firstName: "Cassie",
        phone: "+49 30 1234567",
        profileImage: "https://cdn.example.com/me.png",
      });
      expect(updated.body).not.toHaveProperty("password");
    });

    it("refuses privileged or malformed profile fields", async () => {
      await createUserFixture({ email: "casey@example.com" });
      const { accessToken } = await loginAs(app, "casey@example.com");
      const update = (body: object) =>
        api().put("/api/users/profile").set(bearer(accessToken)).send(body);

      await update({ userType: "admin" }).expect(400);
      await update({ email: "new@example.com" }).expect(400);
      await update({ isVerified: true }).expect(400);
      await update({ profileImage: "not a url" }).expect(400);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: "casey@example.com" },
      });
      expect(user.userType).toBe("customer");
    });

    it("lets admins read any user and users read only themselves", async () => {
      const { user: casey } = await createUserFixture({
        email: "casey@example.com",
      });
      await createAdminFixture({ email: "admin@example.com" });
      const caseyToken = (await loginAs(app, "casey@example.com")).accessToken;
      const adminToken = (await loginAs(app, "admin@example.com")).accessToken;

      await api()
        .get(`/api/users/${casey.id}`)
        .set(bearer(caseyToken))
        .expect(200);
      const asAdmin = await api()
        .get(`/api/users/${casey.id}`)
        .set(bearer(adminToken))
        .expect(200);
      expect(asAdmin.body).not.toHaveProperty("password");
    });
  });

  describe("DELETE /api/users/profile (anonymisation)", () => {
    it("anonymises a customer, closes their open work, and revokes their tokens", async () => {
      const { user: customer } = await createUserFixture({
        email: "leaving@example.com",
        firstName: "Lena",
      });
      const { provider } = await createProviderFixture({
        email: "pro@example.com",
      });
      const openRequest = await createRequestFixture({
        customerId: customer.id,
      });
      const pendingQuote = await createQuoteFixture({
        requestId: openRequest.id,
        providerId: provider.id,
        customerId: customer.id,
      });
      await prisma.notification.create({
        data: { userId: customer.id, type: "test", title: "t", message: "m" },
      });
      const { accessToken, refreshToken } = await loginAs(
        app,
        "leaving@example.com",
      );

      await api()
        .delete("/api/users/profile")
        .set(bearer(accessToken))
        .expect(200);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: customer.id },
      });
      expect(stored).toMatchObject({
        email: `deleted-${customer.id}@deleted.invalid`,
        firstName: "Gelöschter",
        lastName: "Nutzer",
        phone: null,
        gdprConsent: false,
      });
      expect(stored.deletedAt).not.toBeNull();
      expect(
        (
          await prisma.serviceRequest.findUniqueOrThrow({
            where: { id: openRequest.id },
          })
        ).status,
      ).toBe("cancelled");
      expect(
        (
          await prisma.quote.findUniqueOrThrow({
            where: { id: pendingQuote.id },
          })
        ).status,
      ).toBe("rejected");
      expect(
        await prisma.notification.count({ where: { userId: customer.id } }),
      ).toBe(0);

      await api()
        .get("/api/users/profile")
        .set(bearer(accessToken))
        .expect(401);
      await api().post("/api/auth/refresh").send({ refreshToken }).expect(401);
      await api()
        .post("/api/auth/login")
        .send({ email: "leaving@example.com", password: TEST_PASSWORD })
        .expect(401);

      // The address is free for a fresh registration.
      await api()
        .post("/api/auth/register")
        .send({
          email: "leaving@example.com",
          password: TEST_PASSWORD,
          firstName: "Lena",
          lastName: "Again",
          userType: "customer",
          gdprConsent: true,
        })
        .expect(201);
    });

    it("anonymises a provider and withdraws their offers and listing", async () => {
      const { user: customer } = await createUserFixture({
        email: "cust@example.com",
      });
      const { provider } = await createProviderFixture({
        email: "closing-pro@example.com",
      });
      const serviceRequest = await createRequestFixture({
        customerId: customer.id,
      });
      const quote = await createQuoteFixture({
        requestId: serviceRequest.id,
        providerId: provider.id,
        customerId: customer.id,
      });
      const { accessToken } = await loginAs(app, "closing-pro@example.com");

      await api()
        .delete("/api/users/profile")
        .set(bearer(accessToken))
        .expect(200);

      expect(
        (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } }))
          .status,
      ).toBe("expired");
      expect(
        await prisma.provider.findUniqueOrThrow({ where: { id: provider.id } }),
      ).toMatchObject({ isApproved: false, companyName: null });
      expect(
        await prisma.service.count({
          where: { providerId: provider.id, isActive: true },
        }),
      ).toBe(0);
      // The customer's request stays open for other providers.
      expect(
        (
          await prisma.serviceRequest.findUniqueOrThrow({
            where: { id: serviceRequest.id },
          })
        ).status,
      ).toBe("open");
    });

    it("refuses while bookings are active", async () => {
      const { user: customer } = await createUserFixture({
        email: "busy@example.com",
      });
      const { provider } = await createProviderFixture({
        email: "pro@example.com",
      });
      await createDealFixture({
        customerId: customer.id,
        providerId: provider.id,
        bookingStatus: "confirmed",
      });
      const customerToken = (await loginAs(app, "busy@example.com"))
        .accessToken;
      const providerToken = (await loginAs(app, "pro@example.com")).accessToken;

      await api()
        .delete("/api/users/profile")
        .set(bearer(customerToken))
        .expect(409);
      await api()
        .delete("/api/users/profile")
        .set(bearer(providerToken))
        .expect(409);
      expect(
        await prisma.user.count({ where: { deletedAt: { not: null } } }),
      ).toBe(0);
    });
  });
});
