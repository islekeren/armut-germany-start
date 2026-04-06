import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const prisma = moduleFixture.get(PrismaService) as any;
    prisma.category.findMany.mockResolvedValue([]);
    prisma.provider.findMany.mockResolvedValue([]);
    prisma.provider.count.mockResolvedValue(0);
    prisma.serviceRequest.findMany.mockResolvedValue([]);
    prisma.serviceRequest.count.mockResolvedValue(0);

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
    if (app) {
      await app.close();
    }
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

  describe("Requests Module", () => {
    describe("GET /api/requests", () => {
      it("should return service requests", () => {
        return request(app.getHttpServer())
          .get("/api/requests?status=open")
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty("data");
            expect(res.body).toHaveProperty("meta");
          });
      });

      it("should support category-slug filtered request listing", () => {
        return request(app.getHttpServer())
          .get("/api/requests?categorySlug=home-cleaning")
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty("data");
            expect(res.body).toHaveProperty("meta");
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });
  });

  describe("Provider Search", () => {
    describe("GET /api/providers", () => {
      it("should support location-based search", () => {
        return request(app.getHttpServer())
          .get("/api/providers?lat=52.52&lng=13.405&radius=25")
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
