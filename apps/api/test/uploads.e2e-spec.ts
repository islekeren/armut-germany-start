import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  closeTestApp,
  createTestApp,
  createUserFixture,
  loginAs,
  resetAndSeedDatabase,
} from "./e2e-utils";

// Runs against the S3 mock from docker-compose.test.yml; setup-e2e.ts points
// UploadsService at it with path-style addressing.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);
const PDF = Buffer.from(
  "%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
);

describe("Uploads (e2e)", () => {
  let app: INestApplication;
  let userId: string;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase();
    userId = (await createUserFixture({ email: "uploader@example.com" })).user
      .id;
    await createUserFixture({ email: "other@example.com" });
    token = (await loginAs(app, "uploader@example.com")).accessToken;
    otherToken = (await loginAs(app, "other@example.com")).accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const api = () => request(app.getHttpServer());
  const png = (name = "photo.png") => ({
    filename: name,
    contentType: "image/png",
  });

  it("stores a profile image under the user's prefix and serves it publicly", async () => {
    const response = await api()
      .post("/api/uploads/profile")
      .set(bearer(token))
      .attach("file", PNG, png())
      .expect(201);

    expect(response.body).toMatchObject({
      filename: "photo.png",
      mimetype: "image/png",
      size: PNG.length,
    });
    expect(response.body.key).toMatch(
      new RegExp(`^profiles/${userId}/[0-9a-f-]+\\.png$`),
    );

    const stored = await fetch(response.body.url);
    expect(stored.status).toBe(200);
    expect(stored.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await stored.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it.each([
    ["portfolio", "portfolios", 10],
    ["request", "requests", 5],
    ["message", "messages", 3],
    ["document", "documents", 5],
  ])(
    "accepts multiple files on /uploads/%s up to its limit",
    async (route, folder, max) => {
      let upload = api().post(`/api/uploads/${route}`).set(bearer(token));
      for (let i = 0; i < 2; i += 1) {
        upload = upload.attach("files", PNG, png(`photo-${i}.png`));
      }
      const response = await upload.expect(201);

      expect(response.body).toHaveLength(2);
      for (const file of response.body) {
        expect(file.key.startsWith(`${folder}/${userId}/`)).toBe(true);
      }

      let tooMany = api().post(`/api/uploads/${route}`).set(bearer(token));
      for (let i = 0; i <= max; i += 1) {
        tooMany = tooMany.attach("files", PNG, png(`photo-${i}.png`));
      }
      await tooMany.expect(400);
    },
  );

  it("accepts PDFs only where documents are allowed", async () => {
    await api()
      .post("/api/uploads/document")
      .set(bearer(token))
      .attach("files", PDF, {
        filename: "licence.pdf",
        contentType: "application/pdf",
      })
      .expect(201);
    await api()
      .post("/api/uploads/profile")
      .set(bearer(token))
      .attach("file", PDF, {
        filename: "licence.pdf",
        contentType: "application/pdf",
      })
      .expect(400);
  });

  it("rejects missing files, disallowed types, and oversized files", async () => {
    await api().post("/api/uploads/profile").set(bearer(token)).expect(400);
    await api().post("/api/uploads/request").set(bearer(token)).expect(400);
    await api()
      .post("/api/uploads/profile")
      .set(bearer(token))
      .attach("file", Buffer.from("<script>alert(1)</script>"), {
        filename: "x.html",
        contentType: "text/html",
      })
      .expect(400);

    const sixMegabytes = Buffer.alloc(6 * 1024 * 1024, 0);
    await api()
      .post("/api/uploads/profile")
      .set(bearer(token))
      .attach("file", sixMegabytes, png("huge.png"))
      .expect(400);
  });

  describe("presigned uploads", () => {
    it("signs a PUT for an allowed type under the user's prefix", async () => {
      const response = await api()
        .post("/api/uploads/presigned")
        .set(bearer(token))
        .send({
          folder: "portfolios",
          filename: "work.png",
          contentType: "image/png",
        })
        .expect(201);

      expect(response.body.key).toMatch(
        new RegExp(`^portfolios/${userId}/[0-9a-f-]+\\.png$`),
      );

      const put = await fetch(response.body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: PNG,
      });
      expect(put.status).toBe(200);
      expect((await fetch(response.body.publicUrl)).status).toBe(200);
    });

    it("refuses unknown folders, disallowed types, and missing fields", async () => {
      const presign = (body: object) =>
        api().post("/api/uploads/presigned").set(bearer(token)).send(body);

      await presign({
        folder: "evil",
        filename: "x.png",
        contentType: "image/png",
      }).expect(400);
      await presign({
        folder: "profiles",
        filename: "x.html",
        contentType: "text/html",
      }).expect(400);
      await presign({
        folder: "profiles",
        filename: "",
        contentType: "image/png",
      }).expect(400);
      await presign({}).expect(400);
    });
  });

  describe("DELETE /api/uploads/:key", () => {
    it("lets the owner delete their object and nobody else", async () => {
      const upload = await api()
        .post("/api/uploads/profile")
        .set(bearer(token))
        .attach("file", PNG, png())
        .expect(201);
      const encodedKey = encodeURIComponent(upload.body.key);

      await api()
        .delete(`/api/uploads/${encodedKey}`)
        .set(bearer(otherToken))
        .expect(403);
      expect((await fetch(upload.body.url)).status).toBe(200);

      await api()
        .delete(`/api/uploads/${encodedKey}`)
        .set(bearer(token))
        .expect(200, { success: true });
      expect((await fetch(upload.body.url)).status).toBe(404);
    });

    it("refuses keys outside the caller's prefixes", async () => {
      for (const key of [
        "profiles/someone-else/file.png",
        `unknown/${userId}/file.png`,
        `profiles/${userId}`,
      ]) {
        await api()
          .delete(`/api/uploads/${encodeURIComponent(key)}`)
          .set(bearer(token))
          .expect(403);
      }
    });
  });
});
