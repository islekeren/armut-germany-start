import request from "supertest";
import { INestApplication } from "@nestjs/common";
import {
  bearer,
  closeTestApp,
  createProviderFixture,
  createRequestFixture,
  createTestApp,
  createUserFixture,
  getCategoryBySlug,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Provider services (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(resetAndSeedDatabase);
  afterAll(async () => {
    await closeTestApp(app);
  });
  const api = () => request(app.getHttpServer());

  it("keeps CRUD, public profiles, search and request matching in sync", async () => {
    const { user, provider } = await createProviderFixture({
      email: "services@example.com",
      categories: [],
    });
    const { user: customer } = await createUserFixture({
      email: "customer@example.com",
    });
    const category = await getCategoryBySlug("home-cleaning");
    const job = await createRequestFixture({ customerId: customer.id });
    const token = (await loginAs(app, user.email)).accessToken;
    await api()
      .post("/api/services")
      .set(bearer(token))
      .send({
        categoryId: category.id,
        title: "Deep clean",
        description: "A careful clean",
        priceType: "hourly",
        providerId: "untrusted-provider",
        images: ["untrusted"],
      })
      .expect(400);
    const created = await api()
      .post("/api/services")
      .set(bearer(token))
      .send({
        categoryId: category.id,
        title: "Deep clean",
        description: "A careful clean",
        priceType: "hourly",
        priceMin: 20,
        priceMax: 60,
      })
      .expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({ providerId: provider.id, images: [] });
    const profile = await api()
      .get(`/api/providers/${provider.id}/profile`)
      .expect(200);
    expect(profile.body.services).toEqual([
      expect.objectContaining({ id, priceMin: 20 }),
    ]);
    const matched = await api()
      .get("/api/providers/me/requests")
      .set(bearer(token))
      .expect(200);
    expect(
      matched.body.data.map((entry: { id: string }) => entry.id),
    ).toContain(job.id);
    const search = await api()
      .get(`/api/providers?categoryId=${category.id}`)
      .expect(200);
    expect(search.body.data.map((entry: { id: string }) => entry.id)).toContain(
      provider.id,
    );

    await api()
      .patch(`/api/services/${id}`)
      .set(bearer(token))
      .send({
        title: "Updated clean",
        priceMin: null,
        priceMax: null,
        isActive: false,
      })
      .expect(200);
    expect(
      (await api().get(`/api/providers/${provider.id}/profile`)).body.services,
    ).toEqual([]);
    expect(
      (await api().get("/api/providers/me/requests").set(bearer(token))).body
        .data,
    ).toEqual([]);
    expect(
      (
        await api()
          .get(`/api/requests/for-provider/${provider.id}`)
          .set(bearer(token))
      ).body.data,
    ).toEqual([]);
    expect(
      (await api().get(`/api/providers?categoryId=${category.id}`)).body.data,
    ).toEqual([]);
    const own = await api().get("/api/services").set(bearer(token)).expect(200);
    expect(own.body).toEqual([
      expect.objectContaining({ id, isActive: false, priceMin: null }),
    ]);

    await api()
      .patch(`/api/services/${id}`)
      .set(bearer(token))
      .send({ isActive: true })
      .expect(200);
    expect(
      (await api().get(`/api/providers/${provider.id}/profile`)).body.services,
    ).toEqual([expect.objectContaining({ id, title: "Updated clean" })]);
    const officeCategory = await getCategoryBySlug("office-cleaning");
    const officeJob = await createRequestFixture({
      customerId: customer.id,
      categorySlug: "office-cleaning",
    });
    await api()
      .patch(`/api/services/${id}`)
      .set(bearer(token))
      .send({ categoryId: officeCategory.id })
      .expect(200);
    const rematched = await api()
      .get("/api/providers/me/requests")
      .set(bearer(token))
      .expect(200);
    expect(
      rematched.body.data.map((entry: { id: string }) => entry.id),
    ).toEqual([officeJob.id]);
    expect(
      (await api().get(`/api/providers?categoryId=${category.id}`)).body.data,
    ).toEqual([]);
    expect(
      (await api().get(`/api/providers/${provider.id}/profile`)).body.services,
    ).toEqual([expect.objectContaining({ id, categoryId: officeCategory.id })]);
    await api().delete(`/api/services/${id}`).set(bearer(token)).expect(200);
    expect(await prisma.service.findUnique({ where: { id } })).toBeNull();
    expect(
      (await api().get("/api/providers/me/requests").set(bearer(token))).body
        .data,
    ).toEqual([]);
  });

  it("rejects customers and prevents cross-provider mutations", async () => {
    const owner = await createProviderFixture({ email: "owner@example.com" });
    const outsider = await createProviderFixture({
      email: "outsider@example.com",
    });
    const customer = await createUserFixture({ email: "customer@example.com" });
    const owned = await prisma.service.findFirstOrThrow({
      where: { providerId: owner.provider.id },
    });
    const strangerToken = (await loginAs(app, outsider.user.email)).accessToken;
    const customerToken = (await loginAs(app, customer.user.email)).accessToken;
    await api().get("/api/services").set(bearer(customerToken)).expect(403);
    await api()
      .post("/api/services")
      .set(bearer(customerToken))
      .send({
        categoryId: owned.categoryId,
        title: "Test",
        description: "Test",
        priceType: "quote",
      })
      .expect(403);
    await api()
      .patch(`/api/services/${owned.id}`)
      .set(bearer(strangerToken))
      .send({ isActive: false })
      .expect(404);
    await api()
      .delete(`/api/services/${owned.id}`)
      .set(bearer(strangerToken))
      .expect(404);
    expect(
      await prisma.service.findUnique({ where: { id: owned.id } }),
    ).toMatchObject({ isActive: true, providerId: owner.provider.id });
  });

  it("rejects invalid fields, inactive categories and inconsistent partial prices", async () => {
    const { user, provider } = await createProviderFixture({
      email: "validation@example.com",
    });
    const token = (await loginAs(app, user.email)).accessToken;
    const owned = await prisma.service.findFirstOrThrow({
      where: { providerId: provider.id },
    });
    const data = {
      categoryId: owned.categoryId,
      title: "Test",
      description: "Test",
      priceType: "quote",
    };
    for (const patch of [
      { title: " " },
      { priceType: null },
      { priceMin: -1 },
      { priceMin: 100, priceMax: 50 },
      { categoryId: "00000000-0000-4000-8000-000000000001" },
    ]) {
      await api()
        .post("/api/services")
        .set(bearer(token))
        .send({ ...data, ...patch })
        .expect(400);
    }
    await api()
      .patch(`/api/services/${owned.id}`)
      .set(bearer(token))
      .send({ priceMin: 100 })
      .expect(400);
    await api()
      .patch(`/api/services/${owned.id}`)
      .set(bearer(token))
      .send({ title: null })
      .expect(400);
    await prisma.category.update({
      where: { id: owned.categoryId },
      data: { isActive: false },
    });
    await api().post("/api/services").set(bearer(token)).send(data).expect(400);
    await api()
      .patch(`/api/services/${owned.id}`)
      .set(bearer(token))
      .send({ isActive: false })
      .expect(200);
    await api()
      .patch(`/api/services/${owned.id}`)
      .set(bearer(token))
      .send({ isActive: true })
      .expect(400);
  });
});
