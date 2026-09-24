import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  closeTestApp,
  createProviderFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  getCategoryBySlug,
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
