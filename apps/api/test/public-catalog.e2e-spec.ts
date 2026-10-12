import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createCompletedReviewFixture,
  createProviderFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  getCategoryBySlug,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

// Anonymous, read-only endpoints that power the marketing and search pages.
describe("Public catalog (e2e)", () => {
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

  it("GET /api/health reports ok", async () => {
    const response = await api().get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  describe("categories", () => {
    it("lists active branch categories with their sector", async () => {
      const response = await api().get("/api/categories").expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.every((c: { parentId: string | null }) => c.parentId),
      ).toBe(true);
      const cleaning = response.body.find(
        (c: { slug: string }) => c.slug === "home-cleaning",
      );
      expect(cleaning.parent.slug).toBe("cleaning-care");
    });

    it("resolves a branch by slug and returns null for sectors and unknown slugs", async () => {
      const branch = await api()
        .get("/api/categories/home-cleaning")
        .expect(200);
      expect(branch.body).toMatchObject({
        slug: "home-cleaning",
        parent: { slug: "cleaning-care" },
      });

      // The web client types this endpoint as Category | null.
      for (const slug of ["cleaning-care", "does-not-exist"]) {
        const response = await api().get(`/api/categories/${slug}`).expect(200);
        expect(response.body).toEqual({});
      }
    });
  });

  describe("provider search", () => {
    it("lists only approved providers and filters by category and rating", async () => {
      const { provider: cleaner } = await createProviderFixture({
        email: "cleaner@example.com",
        companyName: "Clean Co",
        categories: ["home-cleaning"],
      });
      await createProviderFixture({
        email: "electric@example.com",
        companyName: "Volt Co",
        categories: ["electrician"],
      });
      await createProviderFixture({
        email: "pending@example.com",
        companyName: "Pending Co",
        isApproved: false,
      });

      const all = await api().get("/api/providers").expect(200);
      expect(all.body.meta.total).toBe(2);

      const cleaningCategory = await getCategoryBySlug("home-cleaning");
      const cleaners = await api()
        .get(`/api/providers?categoryId=${cleaningCategory.id}`)
        .expect(200);
      expect(cleaners.body.data.map((p: { id: string }) => p.id)).toEqual([
        cleaner.id,
      ]);

      const rated = await api().get("/api/providers?minRating=4").expect(200);
      expect(rated.body.data).toEqual([]);

      await api().get("/api/providers?minRating=9").expect(400);
      await api().get("/api/providers?page=0").expect(400);
      await api().get("/api/providers?limit=0").expect(400);
      await api().get("/api/requests?page=0").expect(400);
    });

    it("matches providers whose service radius reaches the customer's postcode", async () => {
      await createProviderFixture({
        email: "berlin@example.com",
        companyName: "Berlin Co",
      });

      const berlin = await api()
        .get("/api/providers?postalCode=10115")
        .expect(200);
      expect(berlin.body.data).toHaveLength(1);

      const munich = await api()
        .get("/api/providers?postalCode=80331")
        .expect(200);
      expect(munich.body.data).toHaveLength(0);

      await api().get("/api/providers?postalCode=00000").expect(400);
    });

    it("keeps populated verification and completed-booking data private on every public provider route", async () => {
      const { provider, user } = await createProviderFixture({
        email: "private-provider@example.com",
        companyName: "Public Cleaning Co",
      });
      const taxId = "PRIVATE-TAX-987654321";
      const document = "https://private.example.com/verification-secret.pdf";
      await prisma.provider.update({
        where: { id: provider.id },
        data: { taxId, documents: [document] },
      });
      await prisma.providerProfile.update({
        where: { providerId: provider.id },
        data: { phoneVisible: false },
      });
      const { user: customer } = await createUserFixture({
        email: "private-customer@example.com",
      });
      const { booking, quote, review } = await createCompletedReviewFixture({
        customerId: customer.id,
        providerId: provider.id,
        providerUserId: user.id,
      });

      const assertPrivateDataAbsent = (payload: unknown) => {
        const serialized = JSON.stringify(payload);
        for (const secret of [
          taxId,
          document,
          customer.id,
          customer.email,
          booking.id,
          quote.id,
          user.email,
          user.phone!,
        ]) {
          expect(serialized).not.toContain(secret);
        }
        // Check keys recursively so a nested relation cannot silently reintroduce
        // customer identity, transaction details, or verification records.
        const visit = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          for (const [key, child] of Object.entries(value)) {
            expect([
              "taxId",
              "documents",
              "bookings",
              "customerId",
              "reviewerId",
              "revieweeId",
              "bookingId",
              "quoteId",
              "scheduledDate",
              "completedAt",
              "totalPrice",
              "paymentStatus",
              "email",
              "password",
            ]).not.toContain(key);
            visit(child);
          }
        };
        visit(payload);
      };

      const category = await getCategoryBySlug("home-cleaning");
      for (const query of [
        "",
        "?postalCode=10115",
        "?lat=52.52&lng=13.405&radius=50",
        `?categoryId=${category.id}&minRating=4`,
      ]) {
        const response = await api().get(`/api/providers${query}`).expect(200);
        expect(response.body.meta.total).toBe(1);
        const listed = response.body.data[0];
        expect(listed).toMatchObject({
          id: provider.id,
          companyName: "Public Cleaning Co",
          ratingAvg: 5,
          serviceAreaRadius: 25,
          profile: { city: "Berlin" },
          services: [
            {
              categoryId: category.id,
              priceMin: 40,
              category: { slug: "home-cleaning" },
            },
          ],
        });
        assertPrivateDataAbsent(response.body);
      }

      const detail = await api()
        .get(`/api/providers/${provider.id}`)
        .expect(200);
      expect(detail.body.id).toBe(provider.id);
      assertPrivateDataAbsent(detail.body);

      const profile = await api()
        .get(`/api/providers/${provider.id}/profile`)
        .expect(200);
      assertPrivateDataAbsent(profile.body);
      expect(profile.body.user.phone).toBeNull();
      expect(profile.body.completedJobs).toBe(1);
      expect(profile.body.reviews.items[0]).toMatchObject({
        id: review.id,
        rating: 5,
        comment: "Excellent work and clear communication.",
        service: { category: { slug: "home-cleaning" } },
      });

      // Redaction is specific to public routes; the owner keeps their records.
      const { accessToken } = await loginAs(app, user.email);
      const own = await api()
        .get("/api/providers/me")
        .set(bearer(accessToken))
        .expect(200);
      expect(own.body).toMatchObject({ taxId, documents: [document] });

      await prisma.providerProfile.update({
        where: { providerId: provider.id },
        data: { phoneVisible: true },
      });
      const visible = await api()
        .get(`/api/providers/${provider.id}/profile`)
        .expect(200);
      expect(visible.body.user.phone).toBe(user.phone);
    });

    it("serves provider details and the public profile", async () => {
      const { provider } = await createProviderFixture({
        email: "cleaner@example.com",
        companyName: "Clean Co",
      });

      const detail = await api()
        .get(`/api/providers/${provider.id}`)
        .expect(200);
      expect(detail.body.id).toBe(provider.id);
      expect(JSON.stringify(detail.body)).not.toContain("password");

      const profile = await api()
        .get(`/api/providers/${provider.id}/profile`)
        .expect(200);
      expect(JSON.stringify(profile.body)).not.toContain("password");

      await api()
        .get("/api/providers/00000000-0000-0000-0000-000000000000")
        .expect(404);
      await api()
        .get("/api/providers/00000000-0000-0000-0000-000000000000/profile")
        .expect(404);
    });
  });

  describe("public request board", () => {
    it("lists open requests without private customer data", async () => {
      const { user: customer } = await createUserFixture({
        email: "cust@example.com",
        lastName: "Schmidt",
      });
      const open = await createRequestFixture({
        customerId: customer.id,
        title: "Open job",
      });
      await createRequestFixture({
        customerId: customer.id,
        title: "Taken job",
        status: "in_progress",
      });
      await createRequestFixture({
        customerId: customer.id,
        title: "Wiring",
        categorySlug: "electrician",
      });

      const board = await api().get("/api/requests").expect(200);
      const titles = board.body.data
        .map((r: { title: string }) => r.title)
        .sort();
      expect(titles).toEqual(["Open job", "Wiring"]);

      const listed = board.body.data.find(
        (r: { id: string }) => r.id === open.id,
      );
      expect(listed).not.toHaveProperty("address");
      expect(listed).not.toHaveProperty("customerId");
      expect(listed).not.toHaveProperty("lat");
      expect(listed.customer).toEqual(
        expect.objectContaining({ lastName: "S." }),
      );
      expect(listed.customer).not.toHaveProperty("email");

      const filtered = await api()
        .get("/api/requests?categorySlug=electrician")
        .expect(200);
      expect(filtered.body.data.map((r: { title: string }) => r.title)).toEqual(
        ["Wiring"],
      );
    });
  });
});
