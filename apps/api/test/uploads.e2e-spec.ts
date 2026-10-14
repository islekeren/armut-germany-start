import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  bearer,
  prisma,
  createConversationFixture,
  closeTestApp,
  createTestApp,
  createUserFixture,
  loginAs,
  resetAndSeedDatabase,
} from "./e2e-utils";

// Runs against the S3 mock from docker-compose.test.yml; setup-e2e.ts points
// UploadsService at it with path-style addressing.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
let PDF: Buffer;

describe("Uploads (e2e)", () => {
  let app: INestApplication;
  let userId: string;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const pdf = await PDFDocument.create();
    pdf.addPage();
    PDF = Buffer.from(await pdf.save({ useObjectStreams: false }));
    const storage = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    await storage
      .send(new CreateBucketCommand({ Bucket: process.env.S3_PRIVATE_BUCKET }))
      .catch((error: { name: string }) => {
        if (error.name !== "BucketAlreadyOwnedByYou") throw error;
      });
    storage.destroy();
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
      size: (await sharp(PNG).png().toBuffer()).length,
    });
    expect(response.body.key).toMatch(
      new RegExp(`^profiles/${userId}/[0-9a-f-]+\\.png$`),
    );

    const stored = await fetch(response.body.url);
    expect(stored.status).toBe(200);
    expect(stored.headers.get("content-type")).toBe("image/png");
    expect(
      Buffer.from(await stored.arrayBuffer()).equals(
        await sharp(PNG).png().toBuffer(),
      ),
    ).toBe(true);
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
      .expect(413);
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
        new RegExp(`^quarantine/${userId}/[0-9a-f-]+$`),
      );

      const put = await fetch(response.body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: PNG,
      });
      expect(put.status).toBe(200);
      expect(response.body).not.toHaveProperty("publicUrl");
      await api()
        .post("/api/uploads/finalize")
        .set(bearer(otherToken))
        .send({ key: response.body.key })
        .expect(403);
      const finalized = await api()
        .post("/api/uploads/finalize")
        .set(bearer(token))
        .send({ key: response.body.key })
        .expect(201);
      expect(finalized.body.key).toMatch(
        new RegExp(`^portfolios/${userId}/[0-9a-f-]+\\.png$`),
      );
      expect((await fetch(finalized.body.url)).status).toBe(200);
      await api()
        .post("/api/uploads/finalize")
        .set(bearer(token))
        .send({ key: response.body.key })
        .expect(403);
      // The original signed PUT may be replayed, but cannot alter the validated destination.
      await fetch(response.body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: Buffer.from("invalid"),
      });
      expect(
        Buffer.from(
          await (await fetch(finalized.body.url)).arrayBuffer(),
        ).equals(await sharp(PNG).png().toBuffer()),
      ).toBe(true);
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

  it("normalizes an HTML filename to verified PNG and rejects spoofed content", async () => {
    const result = await api()
      .post("/api/uploads/profile")
      .set(bearer(token))
      .attach("file", PNG, png("x.html"))
      .expect(201);
    expect(result.body.key).toMatch(/\.png$/);
    await api()
      .post("/api/uploads/profile")
      .set(bearer(token))
      .attach("file", Buffer.from("<html>"), png())
      .expect(400);
  });

  it("requires owner/admin for document reads and authentication for all private reads", async () => {
    await createUserFixture({
      email: "admin-upload@example.com",
      userType: "admin",
    });
    const admin = (await loginAs(app, "admin-upload@example.com")).accessToken;
    const uploaded = await api()
      .post("/api/uploads/document")
      .set(bearer(token))
      .attach("files", PDF, {
        filename: "doc.pdf",
        contentType: "application/pdf",
      })
      .expect(201);
    const key = uploaded.body[0].key;
    expect(uploaded.body[0].url).toBe(key);
    const route = `/api/uploads/read/${encodeURIComponent(key)}`;
    await api().get(route).expect(401);
    await api().get(route).set(bearer(otherToken)).expect(403);
    const response = await api().get(route).set(bearer(token)).expect(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.expiresIn).toBe(300);
    expect((await fetch(response.body.url)).status).toBe(200);
    await api().get(route).set(bearer(admin)).expect(200);
  });

  it("limits message reads to the conversation and rejects borrowed/unverified references", async () => {
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: "other@example.com" },
    });
    const third = await createUserFixture({ email: "third@example.com" });
    const thirdToken = (await loginAs(app, third.user.email)).accessToken;
    const conversation = await createConversationFixture({
      participantIds: [userId, other.id],
    });
    const uploaded = await api()
      .post("/api/uploads/message")
      .set(bearer(token))
      .attach("files", PNG, png())
      .expect(201);
    const key = uploaded.body[0].key;
    const send = (auth: string, attachments: string[]) =>
      api().post("/api/messages/send").set(bearer(auth)).send({
        conversationId: conversation.id,
        content: "attachment",
        attachments,
      });
    await send(otherToken, [key]).expect(403);
    await send(token, [`quarantine/${userId}/fake`]).expect(403);
    await send(token, [key]).expect(201);
    const route = `/api/uploads/read/${encodeURIComponent(key)}`;
    await api().get(route).set(bearer(token)).expect(200);
    await api().get(route).set(bearer(otherToken)).expect(200);
    await api().get(route).set(bearer(thirdToken)).expect(403);
  });

  it.each([Buffer.from("<html>"), Buffer.alloc(6 * 1024 * 1024)])(
    "rejects invalid/oversized quarantine content without publishing",
    async (body) => {
      const presigned = await api()
        .post("/api/uploads/presigned")
        .set(bearer(token))
        .send({
          folder: "profiles",
          filename: "x.png",
          contentType: "image/png",
        })
        .expect(201);
      expect(presigned.body).not.toHaveProperty("publicUrl");
      await fetch(presigned.body.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body,
      });
      await api()
        .post("/api/uploads/finalize")
        .set(bearer(token))
        .send({ key: presigned.body.key })
        .expect(400);
      const record = await prisma.uploadAsset.findUniqueOrThrow({
        where: { key: presigned.body.key },
      });
      expect(record.status).toBe("rejected");
      expect(
        (
          await fetch(
            `${process.env.S3_PUBLIC_URL}/profiles/${userId}/${record.id}.png`,
          )
        ).status,
      ).toBe(404);
    },
  );

  it("enforces account allowances atomically across concurrent presigns", async () => {
    await prisma.uploadAsset.createMany({
      data: Array.from({ length: 99 }, () => {
        const id = randomUUID();
        return {
          id,
          ownerId: userId,
          folder: "profiles",
          key: `profiles/${userId}/${id}.png`,
          status: "ready",
          size: 1,
          mimetype: "image/png",
          filename: "x.png",
          expiresAt: new Date(),
        };
      }),
    });
    const presign = () =>
      api().post("/api/uploads/presigned").set(bearer(token)).send({
        folder: "profiles",
        filename: "x.png",
        contentType: "image/png",
      });
    const responses = await Promise.all([presign(), presign()]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 429]);
    expect(await prisma.uploadAsset.count({ where: { ownerId: userId } })).toBe(
      100,
    );
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
