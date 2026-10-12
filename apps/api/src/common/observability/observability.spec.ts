import {
  Controller,
  Get,
  HttpException,
  INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../../app.setup";
import { SafeRuntimeLogger } from "./safe-runtime-logger";
import { PrismaService } from "../prisma/prisma.service";
import { ThrottleModule } from "../throttle/throttle.module";
import { HealthModule } from "../../modules/health/health.module";

const SECRET =
  "postgresql://user:private-password@db.test/private?token=secret";
const ID = "9e6e6c93-2ff4-4daa-bc2f-36c8ed974870";
@Controller("test")
class TestController {
  @Get(":id/failure") failure() {
    throw new Error(SECRET);
  }
  @Get("expected") expected() {
    throw new HttpException(
      { message: "Expected failure", detail: "preserved" },
      409,
    );
  }
}

describe("HTTP observability", () => {
  let app: INestApplication;
  let output: jest.SpyInstance;
  const database = { $queryRaw: jest.fn() };
  const logs = () =>
    output.mock.calls.map(([line]) => JSON.parse(String(line)));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule, ThrottleModule],
      controllers: [TestController],
    })
      .overrideProvider(PrismaService)
      .useValue(database)
      .compile();
    app = module.createNestApplication({ logger: new SafeRuntimeLogger() });
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    database.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    output = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => output.mockRestore());
  afterAll(async () => {
    await app?.close();
  });

  it("keeps liveness independent of the database and correlates safe structured logs", async () => {
    database.$queryRaw.mockRejectedValue(new Error(SECRET));
    const response = await request(app.getHttpServer())
      .get("/api/health?token=private-query")
      .set("X-Request-ID", ID)
      .set("Authorization", "Bearer private-token")
      .expect(200);
    expect(response.body).toEqual({
      status: "ok",
      timestamp: expect.any(String),
    });
    expect(response.headers["x-request-id"]).toBe(ID);
    expect(logs()).toContainEqual({
      event: "http_request",
      requestId: ID,
      method: "GET",
      route: "/api/health",
      status: 200,
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(logs())).not.toMatch(
      /private-query|private-token|private-password/,
    );
  });
  it("replaces malformed request IDs and logs registered templates for generic 500s", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/test/private-user-id/failure?token=secret")
      .set("X-Request-ID", SECRET)
      .expect(500);
    expect(response.headers["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.body).toEqual({
      statusCode: 500,
      message: "Internal server error",
    });
    expect(logs()).toContainEqual(
      expect.objectContaining({
        event: "http_request",
        requestId: response.headers["x-request-id"],
        route: "/api/test/:id/failure",
        status: 500,
      }),
    );
    expect(JSON.stringify(logs()) + JSON.stringify(response.body)).not.toMatch(
      /private-user-id|private-password|postgresql|token=secret/,
    );
  });
  it("preserves deliberate HttpException response semantics", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/test/expected")
      .expect(409);
    expect(response.body).toEqual({
      message: "Expected failure",
      detail: "preserved",
    });
    expect(response.headers["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("reports database readiness without exposing connection failures", async () => {
    await request(app.getHttpServer())
      .get("/api/health/ready")
      .expect(200, {
        status: "ready",
        checks: { database: "up" },
        commit: "unknown",
      });
    database.$queryRaw.mockRejectedValue(new Error(SECRET));
    const response = await request(app.getHttpServer())
      .get("/api/health/ready")
      .expect(503);
    expect(response.body).toEqual({
      status: "unavailable",
      checks: { database: "down" },
      commit: "unknown",
    });
    expect(
      JSON.stringify(logs()) + JSON.stringify(response.body),
    ).not.toContain(SECRET);
  });
  it("reports only validated deployment commit metadata", async () => {
    const original = process.env.RAILWAY_GIT_COMMIT_SHA;
    try {
      process.env.RAILWAY_GIT_COMMIT_SHA = "a".repeat(40);
      const deployed = await request(app.getHttpServer())
        .get("/api/health/ready")
        .expect(200);
      expect(deployed.body.commit).toBe("a".repeat(40));
      process.env.RAILWAY_GIT_COMMIT_SHA = SECRET;
      const invalid = await request(app.getHttpServer())
        .get("/api/health/ready")
        .expect(200);
      expect(invalid.body.commit).toBe("unknown");
    } finally {
      if (original === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
      else process.env.RAILWAY_GIT_COMMIT_SHA = original;
    }
  });
  it("bounds readiness when the database does not answer", async () => {
    database.$queryRaw.mockImplementation(() => new Promise(() => undefined));
    const started = Date.now();
    await request(app.getHttpServer()).get("/api/health/ready").expect(503);
    expect(Date.now() - started).toBeLessThan(2000);
  });
  it("accepts validated client reports anonymously without reflecting details", async () => {
    await request(app.getHttpServer())
      .post("/api/health/client-error")
      .send({ operation: "bookings", code: "http", status: 503, requestId: ID })
      .expect(204);
    expect(logs()).toContainEqual({
      event: "client_error",
      operation: "bookings",
      code: "http",
      status: 503,
      requestId: ID,
    });
  });
  it.each([
    { operation: "unknown", code: "render", message: SECRET },
    { operation: "private-user-id", code: "http" },
    { operation: "unknown", code: "error" },
    { operation: "unknown", code: "http", status: 200 },
    { operation: "unknown", code: "http", status: "503" },
    { operation: "unknown", code: "http", status: 500.5 },
    { operation: "unknown", code: "http", requestId: SECRET },
    { operation: "unknown", code: "http", status: null },
  ])("rejects malformed telemetry %j", async (body) => {
    await request(app.getHttpServer())
      .post("/api/health/client-error")
      .send(body)
      .expect(400);
    expect(logs().filter((line) => line.event === "client_error")).toEqual([]);
    expect(JSON.stringify(logs())).not.toContain(SECRET);
  });
  it("allows and exposes correlation headers through CORS", async () => {
    const response = await request(app.getHttpServer())
      .options("/api/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "X-Request-ID")
      .expect(204);
    expect(response.headers["access-control-allow-headers"]).toContain(
      "X-Request-ID",
    );
    expect(response.headers["access-control-expose-headers"]).toContain(
      "X-Request-ID",
    );
  });
  it("limits client reports to twenty per minute", async () => {
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .post("/api/health/client-error")
        .set("X-Forwarded-For", "192.0.2.52")
        .send({ operation: "unknown", code: "render" })
        .expect(204);
    }
    await request(app.getHttpServer())
      .post("/api/health/client-error")
      .set("X-Forwarded-For", "192.0.2.52")
      .send({ operation: "unknown", code: "render" })
      .expect(429);
  });
});
