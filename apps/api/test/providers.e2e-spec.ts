import request from "supertest";
import {
  closeTestApp,
  createCompletedReviewFixture,
  createProviderFixture,
  createTestApp,
  createUserFixture,
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
