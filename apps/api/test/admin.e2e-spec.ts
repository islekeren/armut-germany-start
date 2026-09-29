import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createAdminFixture,
  createCompletedReviewFixture,
  createDealFixture,
  createProviderFixture,
  createTestApp,
  createUserFixture,
  getCategoryBySlug,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

describe("Admin (e2e)", () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
    await createAdminFixture({ email: "admin@example.com" });
    adminToken = (await loginAs(app, "admin@example.com")).accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(req: T) =>
    req.set(bearer(adminToken));

  describe("users", () => {
    it("lists, filters, and searches users with pagination", async () => {
      await createUserFixture({ email: "anna@example.com", firstName: "Anna" });
      await createUserFixture({ email: "ben@example.com", firstName: "Ben" });
      await createProviderFixture({ email: "pro@example.com" });

      const page = await asAdmin(
        api().get("/api/admin/users?page=1&limit=2"),
      ).expect(200);
      expect(page.body.data).toHaveLength(2);
      expect(page.body.meta).toMatchObject({ total: 4, page: 1, limit: 2 });
      expect(page.body.data[0]).not.toHaveProperty("password");

      const providers = await asAdmin(
        api().get("/api/admin/users?userType=provider"),
      ).expect(200);
      expect(
        providers.body.data.map((u: { email: string }) => u.email),
      ).toEqual(["pro@example.com"]);

      const search = await asAdmin(
        api().get("/api/admin/users?search=ANNA"),
      ).expect(200);
      expect(search.body.data.map((u: { email: string }) => u.email)).toEqual([
        "anna@example.com",
      ]);

      await asAdmin(api().get("/api/admin/users?page=abc")).expect(400);
    });

    it("reads and verifies a user but refuses other fields", async () => {
      const { user } = await createUserFixture({ email: "anna@example.com" });
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: false },
      });

      const detail = await asAdmin(
        api().get(`/api/admin/users/${user.id}`),
      ).expect(200);
      expect(detail.body.email).toBe("anna@example.com");
      expect(detail.body).not.toHaveProperty("password");

      const verified = await asAdmin(api().patch(`/api/admin/users/${user.id}`))
        .send({ isVerified: true })
        .expect(200);
      expect(verified.body.isVerified).toBe(true);
      expect(verified.body).not.toHaveProperty("password");

      await asAdmin(api().patch(`/api/admin/users/${user.id}`))
        .send({ userType: "admin", password: "plain" })
        .expect(400);
      await asAdmin(api().patch(`/api/admin/users/${UNKNOWN_ID}`))
        .send({ isVerified: true })
        .expect(404);
      await asAdmin(api().get(`/api/admin/users/${UNKNOWN_ID}`)).expect(404);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.userType).toBe("customer");
      expect(stored.password).not.toBe("plain");
    });

    it("anonymises a user through the shared deletion flow", async () => {
      const { user } = await createUserFixture({ email: "anna@example.com" });
      const { accessToken } = await loginAs(app, "anna@example.com");

      await asAdmin(api().delete(`/api/admin/users/${user.id}`)).expect(200);

      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .deletedAt,
      ).not.toBe(null);
      await api().get("/api/auth/me").set(bearer(accessToken)).expect(401);
      await asAdmin(api().delete(`/api/admin/users/${user.id}`)).expect(404);
    });

    it("refuses to delete users with active bookings", async () => {
      const { user } = await createUserFixture({ email: "anna@example.com" });
      const { provider } = await createProviderFixture({
        email: "pro@example.com",
      });
      await createDealFixture({
        customerId: user.id,
        providerId: provider.id,
        bookingStatus: "in_progress",
      });

      await asAdmin(api().delete(`/api/admin/users/${user.id}`)).expect(409);
    });
  });

  describe("providers", () => {
    it("lists pending providers and approves or revokes them", async () => {
      const { provider: pending } = await createProviderFixture({
        email: "pending@example.com",
        companyName: "Pending Co",
        isApproved: false,
      });
      await createProviderFixture({
        email: "approved@example.com",
        companyName: "Live Co",
      });

      const queue = await asAdmin(
        api().get("/api/admin/providers/pending"),
      ).expect(200);
      expect(queue.body.data.map((p: { id: string }) => p.id)).toEqual([
        pending.id,
      ]);

      const approvedList = await asAdmin(
        api().get("/api/admin/providers?isApproved=true"),
      ).expect(200);
      expect(approvedList.body.data).toHaveLength(1);

      const approved = await asAdmin(
        api().patch(`/api/admin/providers/${pending.id}/approve`),
      )
        .send({ approved: true })
        .expect(200);
      expect(approved.body.isApproved).toBe(true);

      const emptyQueue = await asAdmin(
        api().get("/api/admin/providers/pending"),
      ).expect(200);
      expect(emptyQueue.body.data).toEqual([]);

      await asAdmin(api().patch(`/api/admin/providers/${pending.id}/approve`))
        .send({ approved: false })
        .expect(200);
      expect(
        (await prisma.provider.findUniqueOrThrow({ where: { id: pending.id } }))
          .isApproved,
      ).toBe(false);
    });

    it("validates approval payloads and ids", async () => {
      const { provider } = await createProviderFixture({
        email: "pending@example.com",
        isApproved: false,
      });

      await asAdmin(api().patch(`/api/admin/providers/${provider.id}/approve`))
        .send({})
        .expect(400);
      await asAdmin(api().patch(`/api/admin/providers/${UNKNOWN_ID}/approve`))
        .send({ approved: true })
        .expect(404);
    });

    it("also approves through PATCH /api/providers/:id/approve", async () => {
      const { provider } = await createProviderFixture({
        email: "pending@example.com",
        isApproved: false,
      });

      await asAdmin(api().patch(`/api/providers/${provider.id}/approve`))
        .send({ isApproved: true })
        .expect(200);
      expect(
        (
          await prisma.provider.findUniqueOrThrow({
            where: { id: provider.id },
          })
        ).isApproved,
      ).toBe(true);
    });
  });

  describe("categories", () => {
    it("only accepts canonical taxonomy categories", async () => {
      const branch = await getCategoryBySlug("home-cleaning");
      await prisma.category.delete({ where: { id: branch.id } });
      const sector = await getCategoryBySlug("cleaning-care");

      await asAdmin(api().post("/api/admin/categories"))
        .send({ slug: "made-up", nameDe: "X", nameEn: "X", icon: "x" })
        .expect(400);
      await asAdmin(api().post("/api/admin/categories"))
        .send({
          slug: "home-cleaning",
          nameDe: "Wrong",
          nameEn: "Home Cleaning",
          icon: "🧹",
        })
        .expect(400);
      await asAdmin(api().post("/api/admin/categories"))
        .send({
          slug: "home-cleaning",
          nameDe: "Hausreinigung",
          nameEn: "Home Cleaning",
          icon: "🧹",
        })
        .expect(400); // branch without parent
      await asAdmin(api().post("/api/admin/categories")).send({}).expect(400);

      const created = await asAdmin(api().post("/api/admin/categories"))
        .send({
          slug: "home-cleaning",
          nameDe: "Hausreinigung",
          nameEn: "Home Cleaning",
          icon: "🧹",
          parentId: sector.id,
        })
        .expect(201);
      expect(created.body).toMatchObject({
        slug: "home-cleaning",
        parentId: sector.id,
      });

      await asAdmin(api().post("/api/admin/categories"))
        .send({
          slug: "home-cleaning",
          nameDe: "Hausreinigung",
          nameEn: "Home Cleaning",
          icon: "🧹",
          parentId: sector.id,
        })
        .expect(409);
    });

    it("keeps category updates canonical and protects categories that are in use", async () => {
      const unused = await getCategoryBySlug("electrician");
      const inUse = await getCategoryBySlug("home-cleaning");
      await createProviderFixture({
        email: "pro@example.com",
        categories: ["home-cleaning"],
      });

      // Updates may only restate the canonical taxonomy values.
      await asAdmin(api().put(`/api/admin/categories/${unused.id}`))
        .send({ nameEn: unused.nameEn, isActive: true })
        .expect(200);
      await asAdmin(api().put(`/api/admin/categories/${unused.id}`))
        .send({ isActive: false })
        .expect(400);
      await asAdmin(api().put(`/api/admin/categories/${unused.id}`))
        .send({ nameEn: "Sparky" })
        .expect(400);
      await asAdmin(api().put(`/api/admin/categories/${unused.id}`))
        .send({ slug: "renamed" })
        .expect(400);
      await asAdmin(api().put(`/api/admin/categories/${UNKNOWN_ID}`))
        .send({ isActive: true })
        .expect(404);

      await asAdmin(api().delete(`/api/admin/categories/${inUse.id}`)).expect(
        403,
      );
      await asAdmin(api().delete(`/api/admin/categories/${unused.id}`)).expect(
        200,
      );
      await asAdmin(api().delete(`/api/admin/categories/${UNKNOWN_ID}`)).expect(
        404,
      );

      const list = await asAdmin(api().get("/api/admin/categories")).expect(
        200,
      );
      expect(list.body.map((c: { slug: string }) => c.slug)).not.toContain(
        "electrician",
      );
    });
  });

  describe("dashboard and reports", () => {
    it("reports platform totals, revenue, categories, and top providers", async () => {
      const { user: customer } = await createUserFixture({
        email: "anna@example.com",
      });
      const { provider, user: providerUser } = await createProviderFixture({
        email: "pro@example.com",
        companyName: "Top Co",
      });
      const { booking } = await createCompletedReviewFixture({
        customerId: customer.id,
        providerId: provider.id,
        providerUserId: providerUser.id,
        rating: 5,
      });

      const dashboard = await asAdmin(api().get("/api/admin/dashboard")).expect(
        200,
      );
      expect(dashboard.body).toHaveProperty("users");
      expect(dashboard.body).toHaveProperty("providers");
      expect(dashboard.body).toHaveProperty("bookings");
      expect(dashboard.body).toHaveProperty("revenue");

      const day = booking.completedAt!.toISOString().slice(0, 10);
      const revenue = await asAdmin(
        api().get(
          `/api/admin/reports/revenue?startDate=${day}T00:00:00Z&endDate=${day}T23:59:59Z`,
        ),
      ).expect(200);
      expect(revenue.body.totalRevenue).toBe(booking.totalPrice);

      await asAdmin(api().get("/api/admin/reports/revenue")).expect(400);
      await asAdmin(
        api().get("/api/admin/reports/revenue?startDate=soon&endDate=later"),
      ).expect(400);

      await asAdmin(api().get("/api/admin/reports/categories")).expect(200);

      const top = await asAdmin(
        api().get("/api/admin/reports/top-providers?limit=1"),
      ).expect(200);
      expect(top.body).toHaveLength(1);
      expect(top.body[0].id).toBe(provider.id);
    });
  });
});
