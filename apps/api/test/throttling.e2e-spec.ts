import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { closeTestApp, createTestApp, resetAndSeedDatabase } from "./e2e-utils";

// setup-e2e.ts disables throttling for the rest of the suite; this spec turns
// it back on to prove the credential limits still hold.
describe("Throttling (e2e)", () => {
  let app: INestApplication;
  const previous = process.env.THROTTLE_DISABLED;

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = "false";
    await resetAndSeedDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.THROTTLE_DISABLED = previous;
    await closeTestApp(app);
  });

  it("limits login attempts to 10 per minute per client", async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "WrongPassword1!" });

    for (let i = 0; i < 10; i += 1) {
      await attempt().expect(401);
    }

    await attempt().expect(429);
  });

  it("ignores THROTTLE_DISABLED outside NODE_ENV=test", async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.THROTTLE_DISABLED = "true";
    process.env.NODE_ENV = "production";

    try {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "WrongPassword1!" })
        .expect(429);
    } finally {
      process.env.NODE_ENV = nodeEnv;
      process.env.THROTTLE_DISABLED = "false";
    }
  });
});
