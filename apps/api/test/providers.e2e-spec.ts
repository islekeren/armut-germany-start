import request from "supertest";
import {
  closeTestApp,
  createCompletedReviewFixture,
  createProviderFixture,
  createTestApp,
  createUserFixture,
  createRequestFixture,
  getCategoryBySlug,
  prisma,
  bearer,
  loginAs,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Providers (e2e)", () => {
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

  it("can retry profile creation after validation and a lost successful response", async () => {
    const { user } = await createUserFixture({
      email: "resume@example.com",
      userType: "provider",
    });
    const { accessToken } = await loginAs(app, user.email);
    const submit = (data: object) =>
      request(app.getHttpServer())
        .post("/api/providers")
        .set(bearer(accessToken))
        .send(data);
    const data = {
      description: "Reliable cleaning",
      serviceAreaLat: 0,
      serviceAreaLng: 0,
      serviceAreaRadius: 25,
      categories: ["home-cleaning"],
      postalCode: "10115",
    };
    await submit({ ...data, categories: ["unknown"] }).expect(400);
    expect(await prisma.provider.count({ where: { userId: user.id } })).toBe(0);
    const first = await submit(data).expect(201);
    const retry = await submit(data).expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(retry.body.profile.id).toBe(first.body.profile.id);
    expect(await prisma.provider.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.service.count({ where: { providerId: first.body.id } }),
    ).toBe(1);
  });

  it("simultaneous profile retries return the same provider and services", async () => {
    const { user } = await createUserFixture({
      email: "concurrent@example.com",
      userType: "provider",
    });
    const { accessToken } = await loginAs(app, user.email);
    const submit = () =>
      request(app.getHttpServer())
        .post("/api/providers")
        .set(bearer(accessToken))
        .send({
          description: "Reliable cleaning",
          serviceAreaLat: 0,
          serviceAreaLng: 0,
          serviceAreaRadius: 25,
          categories: ["home-cleaning"],
        });
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect(
      await prisma.service.count({
        where: { providerId: responses[0].body.id },
      }),
    ).toBe(1);
  });

  describe("exact active-category and radius policy", () => {
    for (const scenario of [
      "eligible",
      "no-services",
      "inactive",
      "sibling",
      "parent",
      "child-of-parent",
      "outside-radius",
      "closed",
    ]) {
      it(`keeps listings and direct-ID access aligned: ${scenario}`, async () => {
        const { user: customer } = await createUserFixture({
          email: "scope-customer@example.com",
        });
        const { provider, user } = await createProviderFixture({
          email: "scope-provider@example.com",
          categories: scenario === "no-services" ? [] : ["home-cleaning"],
        });
        const leaf = await getCategoryBySlug("home-cleaning");
        const parent = await prisma.category.findUniqueOrThrow({
          where: { id: leaf.parentId! },
        });
        if (scenario === "inactive")
          await prisma.service.updateMany({
            where: { providerId: provider.id },
            data: { isActive: false },
          });
        if (scenario === "child-of-parent")
          await prisma.service.updateMany({
            where: { providerId: provider.id },
            data: { categoryId: parent.id },
          });
        const categorySlug =
          scenario === "sibling"
            ? "office-cleaning"
            : scenario === "parent"
              ? parent.slug
              : "home-cleaning";
        const item = await createRequestFixture({
          customerId: customer.id,
          categorySlug,
          status: scenario === "closed" ? "completed" : "open",
        });
        if (scenario === "outside-radius")
          await prisma.serviceRequest.update({
            where: { id: item.id },
            data: { lat: 48.137, lng: 11.575 },
          });
        const { accessToken } = await loginAs(app, user.email);
        const feed = await request(app.getHttpServer())
          .get("/api/providers/me/requests")
          .set(bearer(accessToken))
          .expect(200);
        expect(feed.body.data.map((r: { id: string }) => r.id)).toEqual(
          scenario === "eligible" ? [item.id] : [],
        );
        await request(app.getHttpServer())
          .get(`/api/providers/me/requests/${item.id}`)
          .set(bearer(accessToken))
          .expect(scenario === "eligible" ? 200 : 404);
      });
    }
  });

  it("creates a missing provider profile and updates profile details", async () => {
    await createProviderFixture({
      email: "provider-profile@example.com",
      companyName: "Berlin Shine",
      categories: ["home-cleaning"],
      withProfile: false,
    });

    const providerAuth = await loginAs(app, "provider-profile@example.com");

    const providerProfile = await request(app.getHttpServer())
      .get("/api/providers/me")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .expect(200);

    expect(providerProfile.body.profile.slug).toContain("berlin-shine");
    expect(providerProfile.body.profile.openingHours).toHaveLength(7);

    await request(app.getHttpServer())
      .put("/api/providers/me/profile")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .send({
        firstName: "Paula",
        lastName: "Provider",
        email: "provider-profile@example.com",
        phone: "+49111111111",
        headline: "Top rated in Berlin",
        city: "Berlin",
        postalCode: "10115",
        website: "https://berlin-shine.example.com",
        priceMin: 55,
        priceMax: 75,
        galleryImages: [" https://example.com/photo-1.png ", ""],
        highlights: [" Fast turnaround ", ""],
        languages: ["German", "English"],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.user.firstName).toBe("Paula");
        expect(response.body.profile.headline).toBe("Top rated in Berlin");
        expect(response.body.profile.galleryImages).toEqual([
          "https://example.com/photo-1.png",
        ]);
        expect(response.body.services[0].priceMin).toBe(55);
        expect(response.body.services[0].priceMax).toBe(75);
      });
  });

  it("returns public profile review data and accepts provider review replies", async () => {
    const { user: customer } = await createUserFixture({
      email: "customer-review@example.com",
      firstName: "Chris",
      lastName: "Customer",
    });
    const { provider, user: providerUser } = await createProviderFixture({
      email: "provider-review@example.com",
      companyName: "Review Ready",
      categories: ["home-cleaning"],
      withProfile: true,
    });

    const { review } = await createCompletedReviewFixture({
      customerId: customer.id,
      providerId: provider.id,
      providerUserId: providerUser.id,
      title: "Detailed move-out cleaning",
      rating: 5,
    });

    const providerAuth = await loginAs(app, "provider-review@example.com");

    await request(app.getHttpServer())
      .get(`/api/providers/${provider.id}/profile`)
      .expect(200)
      .expect((response) => {
        expect(response.body.completedJobs).toBe(1);
        expect(response.body.totalReviews).toBe(1);
        expect(response.body.reviews.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: review.id,
              rating: 5,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get("/api/providers/me/reviews")
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: review.id,
              customerComment: "Excellent work and clear communication.",
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(`/api/providers/me/reviews/${review.id}/reply`)
      .set("Authorization", `Bearer ${providerAuth.accessToken}`)
      .send({
        reply: "Thanks for the feedback!",
        replyImages: [" https://example.com/reply.png ", ""],
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.providerReply).toBe("Thanks for the feedback!");
        expect(response.body.providerReplyImages).toEqual([
          "https://example.com/reply.png",
        ]);
      });
  });
});
