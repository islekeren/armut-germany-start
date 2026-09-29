import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createAdminFixture,
  createDealFixture,
  createProviderFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  loginAs,
  resetAndSeedDatabase,
} from "./e2e-utils";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Route = [Method, string];

const ID = "00000000-0000-0000-0000-000000000000";

// Every route behind JwtAuthGuard. Keep in sync with the controllers; a new
// protected route that is missing here is not covered by the 401 check.
const PROTECTED_ROUTES: Route[] = [
  ["post", "/api/auth/change-password"],
  ["post", "/api/auth/logout"],
  ["get", "/api/auth/me"],
  ["post", "/api/bookings"],
  ["get", "/api/bookings/customer"],
  ["get", "/api/bookings/provider"],
  ["get", "/api/bookings/upcoming/customer"],
  ["get", "/api/bookings/upcoming/provider"],
  ["get", `/api/bookings/${ID}`],
  ["patch", `/api/bookings/${ID}/status`],
  ["patch", `/api/bookings/${ID}/reschedule`],
  ["post", `/api/bookings/${ID}/review`],
  ["post", `/api/bookings/${ID}/reply`],
  ["post", "/api/messages/conversations"],
  ["get", "/api/messages/conversations"],
  ["get", `/api/messages/conversations/${ID}`],
  ["get", `/api/messages/conversations/${ID}/messages`],
  ["post", "/api/messages/send"],
  ["post", "/api/messages/read"],
  ["get", "/api/messages/unread-count"],
  ["get", "/api/notifications"],
  ["get", "/api/notifications/unread-count"],
  ["post", `/api/notifications/${ID}/read`],
  ["post", "/api/notifications/read-all"],
  ["post", "/api/providers"],
  ["get", "/api/providers/me"],
  ["get", "/api/providers/me/stats"],
  ["get", "/api/providers/me/dashboard"],
  ["get", "/api/providers/me/requests"],
  ["get", `/api/providers/me/requests/${ID}`],
  ["get", "/api/providers/me/bookings"],
  ["get", "/api/providers/me/reviews"],
  ["post", `/api/providers/me/reviews/${ID}/reply`],
  ["put", "/api/providers/me/profile"],
  ["put", `/api/providers/${ID}`],
  ["patch", `/api/providers/${ID}/approve`],
  ["post", "/api/quotes"],
  ["get", "/api/quotes/my-quotes"],
  ["get", "/api/quotes/received"],
  ["get", `/api/quotes/request/${ID}`],
  ["get", `/api/quotes/${ID}`],
  ["put", `/api/quotes/${ID}`],
  ["post", `/api/quotes/${ID}/respond`],
  ["delete", `/api/quotes/${ID}`],
  ["post", "/api/requests"],
  ["get", "/api/requests/my"],
  ["get", `/api/requests/for-provider/${ID}`],
  ["get", `/api/requests/${ID}`],
  ["put", `/api/requests/${ID}`],
  ["delete", `/api/requests/${ID}`],
  ["post", "/api/uploads/profile"],
  ["post", "/api/uploads/portfolio"],
  ["post", "/api/uploads/document"],
  ["post", "/api/uploads/request"],
  ["post", "/api/uploads/message"],
  ["post", "/api/uploads/presigned"],
  ["delete", "/api/uploads/some-key"],
  ["get", "/api/users/profile"],
  ["put", "/api/users/profile"],
  ["delete", "/api/users/profile"],
  ["get", `/api/users/${ID}`],
];

const ADMIN_ROUTES: Route[] = [
  ["get", "/api/admin/dashboard"],
  ["get", "/api/admin/users"],
  ["get", `/api/admin/users/${ID}`],
  ["patch", `/api/admin/users/${ID}`],
  ["delete", `/api/admin/users/${ID}`],
  ["get", "/api/admin/providers"],
  ["get", "/api/admin/providers/pending"],
  ["patch", `/api/admin/providers/${ID}/approve`],
  ["get", "/api/admin/categories"],
  ["post", "/api/admin/categories"],
  ["put", `/api/admin/categories/${ID}`],
  ["delete", `/api/admin/categories/${ID}`],
  ["get", "/api/admin/reports/revenue"],
  ["get", "/api/admin/reports/categories"],
  ["get", "/api/admin/reports/top-providers"],
  ["patch", `/api/providers/${ID}/approve`],
];

const PUBLIC_ROUTES: Route[] = [
  ["get", "/api/health"],
  ["get", "/api/categories"],
  ["get", "/api/providers"],
  ["get", "/api/requests"],
];

// Unauthenticated by design; listed so the drift check below knows about them.
const INTENTIONALLY_PUBLIC: Route[] = [
  ["post", "/api/auth/register"],
  ["post", "/api/auth/login"],
  ["post", "/api/auth/refresh"],
  ["get", "/api/categories/:slug"],
  ["get", "/api/providers/:id/profile"],
  ["get", "/api/providers/:id"],
];

function registeredRoutes(app: INestApplication): Route[] {
  const instance = app.getHttpAdapter().getInstance();
  const stack = (instance.router ?? instance._router).stack as {
    route?: { path: string; methods: Record<string, boolean> };
  }[];

  return stack.flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods).map(
          (method) => [method as Method, layer.route!.path] as Route,
        )
      : [],
  );
}

function matchesTemplate([method, template]: Route, [m, path]: Route) {
  const pattern = new RegExp(`^${template.replace(/:[^/]+/g, "[^/]+")}$`);
  return method === m && pattern.test(path);
}

describe("Authorization (e2e)", () => {
  let app: INestApplication;
  let customerToken: string;
  let providerToken: string;

  async function seedBaseUsers() {
    await resetAndSeedDatabase();
    await createUserFixture({ email: "authz-customer@example.com" });
    await createProviderFixture({ email: "authz-provider@example.com" });
    customerToken = (await loginAs(app, "authz-customer@example.com"))
      .accessToken;
    providerToken = (await loginAs(app, "authz-provider@example.com"))
      .accessToken;
  }

  beforeAll(async () => {
    app = await createTestApp();
    // The route tables only read, so they share one seeded state.
    await seedBaseUsers();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());

  it("classifies every registered route", () => {
    const known = [
      ...PROTECTED_ROUTES,
      ...ADMIN_ROUTES,
      ...PUBLIC_ROUTES,
      ...INTENTIONALLY_PUBLIC,
    ];
    const unclassified = registeredRoutes(app)
      .filter((route) => !known.some((entry) => matchesTemplate(route, entry)))
      .map(([method, path]) => `${method.toUpperCase()} ${path}`);

    // Add new routes to PROTECTED_ROUTES, ADMIN_ROUTES, or a public list.
    expect(unclassified).toEqual([]);
  });

  it.each([...PROTECTED_ROUTES, ...ADMIN_ROUTES])(
    "%s %s rejects anonymous callers with 401",
    async (method, path) => {
      await api()[method](path).expect(401);
    },
  );

  it.each([...PROTECTED_ROUTES, ...ADMIN_ROUTES])(
    "%s %s rejects a forged token with 401",
    async (method, path) => {
      await api()[method](path).set(bearer("not.a.jwt")).expect(401);
    },
  );

  it.each(ADMIN_ROUTES)(
    "%s %s rejects customers and providers with 403",
    async (method, path) => {
      await api()[method](path).set(bearer(customerToken)).expect(403);
      await api()[method](path).set(bearer(providerToken)).expect(403);
    },
  );

  it.each(PUBLIC_ROUTES)(
    "%s %s is reachable anonymously",
    async (method, path) => {
      await api()[method](path).expect(200);
    },
  );

  it("lets an admin through the admin guard", async () => {
    await createAdminFixture({ email: "authz-admin@example.com" });
    const adminToken = (await loginAs(app, "authz-admin@example.com"))
      .accessToken;

    await api().get("/api/admin/dashboard").set(bearer(adminToken)).expect(200);
  });

  describe("resource ownership", () => {
    beforeEach(seedBaseUsers);

    it("rejects tokens of deleted accounts", async () => {
      await api()
        .delete("/api/users/profile")
        .set(bearer(customerToken))
        .expect(200);

      await api().get("/api/auth/me").set(bearer(customerToken)).expect(401);
    });

    it("only lets the owner change or cancel a request and hides private fields from others", async () => {
      const { user: owner } = await createUserFixture({
        email: "owner@example.com",
      });
      const ownerToken = (await loginAs(app, "owner@example.com")).accessToken;
      const serviceRequest = await createRequestFixture({
        customerId: owner.id,
      });

      await api()
        .put(`/api/requests/${serviceRequest.id}`)
        .set(bearer(customerToken))
        .send({ title: "Hijacked" })
        .expect(403);
      await api()
        .delete(`/api/requests/${serviceRequest.id}`)
        .set(bearer(customerToken))
        .expect(403);

      const asStranger = await api()
        .get(`/api/requests/${serviceRequest.id}`)
        .set(bearer(providerToken))
        .expect(200);
      expect(asStranger.body).not.toHaveProperty("address");
      expect(asStranger.body).not.toHaveProperty("lat");
      expect(asStranger.body).not.toHaveProperty("quotes");
      expect(asStranger.body).not.toHaveProperty("customerId");
      expect(asStranger.body.customer).not.toHaveProperty("id");
      expect(asStranger.body.customer.lastName).toMatch(/^.\.$/);

      const asOwner = await api()
        .get(`/api/requests/${serviceRequest.id}`)
        .set(bearer(ownerToken))
        .expect(200);
      expect(asOwner.body.address).toBe(serviceRequest.address);
    });

    it("only lets users read their own user record", async () => {
      const { user: other } = await createUserFixture({
        email: "other@example.com",
      });

      await api()
        .get(`/api/users/${other.id}`)
        .set(bearer(customerToken))
        .expect(403);
    });

    it("only lets a provider update its own provider record", async () => {
      const { provider: other } = await createProviderFixture({
        email: "other-provider@example.com",
        companyName: "Other Co",
      });

      await api()
        .put(`/api/providers/${other.id}`)
        .set(bearer(providerToken))
        .send({ description: "Hijacked" })
        .expect(403);
    });

    it("keeps customers out of provider-only endpoints", async () => {
      await api()
        .get("/api/providers/me/dashboard")
        .set(bearer(customerToken))
        .expect(404);
      await api()
        .get("/api/quotes/my-quotes")
        .set(bearer(customerToken))
        .expect(404);
    });

    it("hides another customer's bookings and quotes from list endpoints", async () => {
      const { user: other } = await createUserFixture({
        email: "other@example.com",
      });
      const { provider } = await createProviderFixture({
        email: "deal-provider@example.com",
        companyName: "Deal Co",
      });
      await createDealFixture({
        customerId: other.id,
        providerId: provider.id,
        bookingStatus: "confirmed",
      });

      const bookings = await api()
        .get("/api/bookings/customer")
        .set(bearer(customerToken))
        .expect(200);
      expect(bookings.body.data).toEqual([]);

      const quotes = await api()
        .get("/api/quotes/received")
        .set(bearer(customerToken))
        .expect(200);
      expect(quotes.body).toEqual([]);
    });
  });
});
