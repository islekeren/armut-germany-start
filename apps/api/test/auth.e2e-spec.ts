import request from "supertest";
import { closeTestApp, createTestApp, resetAndSeedDatabase } from "./e2e-utils";

describe("Auth (e2e)", () => {
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

  it("registers, refreshes, verifies, and updates a password", async () => {
    const registerResponse = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({
        email: "customer-auth@example.com",
        password: "Password123!",
        firstName: "Ada",
        lastName: "Lovelace",
        userType: "customer",
        gdprConsent: true,
      })
      .expect(201);

    expect(registerResponse.body.user).toMatchObject({
      email: "customer-auth@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      userType: "customer",
    });
    expect(registerResponse.body.user).not.toHaveProperty("password");
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.refreshToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.email).toBe("customer-auth@example.com");
        expect(response.body).not.toHaveProperty("password");
      });

    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(201)
      .expect((response) => {
        expect(response.body.user.email).toBe("customer-auth@example.com");
        expect(response.body.accessToken).toEqual(expect.any(String));
      });

    await request(app.getHttpServer())
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
      .send({
        currentPassword: "Password123!",
        newPassword: "Password456!",
      })
      .expect(201)
      .expect({ message: "Password changed successfully" });

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "customer-auth@example.com",
        password: "Password123!",
      })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "customer-auth@example.com",
        password: "Password456!",
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.user.email).toBe("customer-auth@example.com");
      });
  });

  it("rejects duplicate registrations and invalid refresh tokens", async () => {
    const payload = {
      email: "customer-auth@example.com",
      password: "Password123!",
      firstName: "Ada",
      lastName: "Lovelace",
      userType: "customer",
      gdprConsent: true,
    };

    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send(payload)
      .expect(409);

    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: "invalid-token" })
      .expect(401);
  });
});
