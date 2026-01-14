import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("Auth Module", () => {
    describe("POST /api/auth/register", () => {
      it("should reject registration with invalid email", () => {
        return request(app.getHttpServer())
          .post("/api/auth/register")
          .send({
            email: "invalid-email",
            password: "Password123!",
            firstName: "Max",
            lastName: "Mustermann",
            userType: "customer",
          })
          .expect(400);
      });

      it("should reject registration with weak password", () => {
        return request(app.getHttpServer())
          .post("/api/auth/register")
          .send({
            email: "test@example.com",
            password: "weak",
            firstName: "Max",
            lastName: "Mustermann",
            userType: "customer",
          })
          .expect(400);
      });

      it("should reject registration with missing required fields", () => {
        return request(app.getHttpServer())
          .post("/api/auth/register")
          .send({
            email: "test@example.com",
          })
          .expect(400);
      });
    });

    describe("POST /api/auth/login", () => {
      it("should reject login with missing credentials", () => {
        return request(app.getHttpServer())
          .post("/api/auth/login")
          .send({})
          .expect(400);
      });
    });
  });

  describe("Categories Module", () => {
    describe("GET /api/categories", () => {
      it("should return categories list", () => {
        return request(app.getHttpServer())
          .get("/api/categories")
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });
  });

  describe("Providers Module", () => {
    describe("GET /api/providers", () => {
      it("should return providers list", () => {
        return request(app.getHttpServer())
          .get("/api/providers")
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty("data");
            expect(res.body).toHaveProperty("meta");
          });
      });

      it("should support pagination", () => {
        return request(app.getHttpServer())
          .get("/api/providers?page=1&limit=10")
          .expect(200)
          .expect((res) => {
            expect(res.body.meta.page).toBe(1);
            expect(res.body.meta.limit).toBe(10);
          });
      });
    });
  });

  describe("Search Module", () => {
    describe("GET /api/search/providers", () => {
      it("should search providers", () => {
        return request(app.getHttpServer())
          .get("/api/search/providers?q=reinigung")
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty("data");
            expect(res.body).toHaveProperty("meta");
          });
      });

      it("should support location-based search", () => {
        return request(app.getHttpServer())
          .get("/api/search/providers?lat=52.52&lng=13.405&radius=25")
          .expect(200);
      });
    });

    describe("GET /api/search/requests", () => {
      it("should search service requests", () => {
        return request(app.getHttpServer())
          .get("/api/search/requests?status=open")
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty("data");
            expect(res.body).toHaveProperty("meta");
          });
      });
    });
  });

  describe("Protected Routes", () => {
    it("should reject unauthenticated requests to protected endpoints", () => {
      return request(app.getHttpServer())
        .post("/api/providers")
        .send({
          companyName: "Test GmbH",
          description: "Test",
        })
        .expect(401);
    });

    it("should reject unauthenticated requests to admin endpoints", () => {
      return request(app.getHttpServer())
        .get("/api/admin/dashboard")
        .expect(401);
    });
  });
});
