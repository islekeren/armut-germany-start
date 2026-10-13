import request from "supertest";
import { createHash, randomBytes } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { RecoveryEmailService } from "../src/modules/auth/recovery-email.service";
import { closeTestApp, createTestApp, createUserFixture, loginAs, prisma, resetAndSeedDatabase } from "./e2e-utils";

describe("Device session revocation (e2e)", () => {
  let app: any;
  const outbox: { email: string; token: string; locale: string }[] = [];
  const email = {
    enabled: true,
    sendReset: jest.fn(async (email: string, token: string, locale: string) => {
      outbox.push({ email, token, locale });
    }),
  };
  beforeAll(async () => {
    app = await createTestApp(builder => builder.overrideProvider(RecoveryEmailService).useValue(email));
  });
  beforeEach(async () => {
    outbox.length = 0;
    email.sendReset.mockClear();
    await resetAndSeedDatabase();
    await createUserFixture({ email: "recovery@example.com" });
  });
  afterAll(async () => { await closeTestApp(app); });

  it("logs out only this device and does not let its refresh restore it", async () => {
    const first = await loginAs(app, "recovery@example.com");
    const second = await loginAs(app, "recovery@example.com");
    await request(app.getHttpServer()).post("/api/auth/logout")
      .auth(first.accessToken, { type: "bearer" }).expect(201);
    await request(app.getHttpServer()).get("/api/auth/me")
      .auth(first.accessToken, { type: "bearer" }).expect(401);
    await request(app.getHttpServer()).post("/api/auth/refresh")
      .send({ refreshToken: first.refreshToken }).expect(401);
    await request(app.getHttpServer()).get("/api/auth/me")
      .auth(second.accessToken, { type: "bearer" }).expect(200);
    await request(app.getHttpServer()).post("/api/auth/refresh")
      .send({ refreshToken: second.refreshToken }).expect(201);
  });

  it("password change revokes access and refresh on both devices", async () => {
    const first = await loginAs(app, "recovery@example.com");
    const second = await loginAs(app, "recovery@example.com");
    await request(app.getHttpServer()).post("/api/auth/change-password")
      .auth(first.accessToken, { type: "bearer" })
      .send({ currentPassword: "Password123!", newPassword: "NewPassword123!" }).expect(201);
    for (const device of [first, second]) {
      await request(app.getHttpServer()).get("/api/auth/me")
        .auth(device.accessToken, { type: "bearer" }).expect(401);
      await request(app.getHttpServer()).post("/api/auth/refresh")
        .send({ refreshToken: device.refreshToken }).expect(401);
    }
    await loginAs(app, "recovery@example.com", "NewPassword123!");
  });

  it("returns indistinguishable forgot-password responses", async () => {
    const known = await request(app.getHttpServer()).post("/api/auth/forgot-password")
      .send({ email: "recovery@example.com", locale: "de" }).expect(201);
    const unknown = await request(app.getHttpServer()).post("/api/auth/forgot-password")
      .send({ email: "unknown@example.com", locale: "de" }).expect(201);
    expect(known.body).toEqual(unknown.body);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].locale).toBe("de");
    expect(JSON.stringify(known.body)).not.toContain("token");
  });

  const api = () => request(app.getHttpServer());
  async function requestReset() {
    await api().post("/api/auth/forgot-password").send({ email: "recovery@example.com", locale: "en" }).expect(201);
    return outbox.at(-1)!.token;
  }
  const hash = (token: string) => createHash("sha256").update(token).digest("hex");
  const reset = (token: string) => api().post("/api/auth/reset-password").send({ token, newPassword: "NewPassword123!" });

  it("stores only hashes, resets once, and revokes every device", async () => {
    const devices = [await loginAs(app, "recovery@example.com"), await loginAs(app, "recovery@example.com")];
    const token = await requestReset();
    const record = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hash(token) } });
    expect(record.tokenHash).not.toBe(token);
    expect(record.tokenHash).toHaveLength(64);
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).toBeCloseTo(30 * 60_000, -3);
    await reset(token).expect(201);
    await reset(token).expect(400);
    for (const device of devices) {
      await api().get("/api/auth/me").auth(device.accessToken, { type: "bearer" }).expect(401);
      await api().post("/api/auth/refresh").send({ refreshToken: device.refreshToken }).expect(401);
    }
    await api().post("/api/auth/login").send({ email: "recovery@example.com", password: "Password123!" }).expect(401);
    await loginAs(app, "recovery@example.com", "NewPassword123!");
  });

  it("rejects expiry and invalid tokens without changing the password", async () => {
    const token = await requestReset();
    await prisma.passwordResetToken.update({ where: { tokenHash: hash(token) }, data: { expiresAt: new Date(0) } });
    await reset(token).expect(400);
    await reset(randomBytes(32).toString("base64url")).expect(400);
    await reset("bad").expect(400);
    await loginAs(app, "recovery@example.com");
  });

  it("permits only one concurrent consumption, including sibling tokens", async () => {
    const first = await requestReset();
    await prisma.user.updateMany({ where: { email: "recovery@example.com" }, data: { passwordResetRequestedAt: new Date(0) } });
    const second = await requestReset();
    const results = await Promise.all([reset(first), reset(second), reset(first)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 400, 400]);
    expect(await prisma.passwordResetToken.count({ where: { consumedAt: null } })).toBe(0);
  });

  it("does not issue duplicate emails inside the persisted account cooldown", async () => {
    await requestReset();
    await requestReset();
    expect(outbox).toHaveLength(1);
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });


  it("returns generic success before slow email delivery completes", async () => {
    let release!: () => void;
    email.sendReset.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    try {
      await api().post("/api/auth/forgot-password").send({ email: "recovery@example.com" })
        .timeout({ response: 1500 }).expect(201);
    } finally { release?.(); }
  });

  it("does not disclose a delivery failure", async () => {
    email.sendReset.mockRejectedValueOnce(new Error("private SMTP payload"));
    const known = await api().post("/api/auth/forgot-password").send({ email: "recovery@example.com" }).expect(201);
    const unknown = await api().post("/api/auth/forgot-password").send({ email: "nobody@example.com" }).expect(201);
    expect(known.body).toEqual(unknown.body);
  });

  it("rejects short passwords and deleted accounts", async () => {
    const token = await requestReset();
    await api().post("/api/auth/reset-password").send({ token, newPassword: "short" }).expect(400);
    await prisma.user.updateMany({ where: { email: "recovery@example.com" }, data: { deletedAt: new Date() } });
    await reset(token).expect(400);
    outbox.length = 0;
    await api().post("/api/auth/forgot-password").send({ email: "recovery@example.com" }).expect(201);
    expect(outbox).toHaveLength(0);
  });

  it("password change invalidates outstanding reset links", async () => {
    const device = await loginAs(app, "recovery@example.com");
    const token = await requestReset();
    await api().post("/api/auth/change-password").auth(device.accessToken, { type: "bearer" })
      .send({ currentPassword: "Password123!", newPassword: "DifferentPassword123!" }).expect(201);
    await reset(token).expect(400);
  });

  it("refresh keeps the same absolute session and rejects expired/legacy JWTs", async () => {
    const device = await loginAs(app, "recovery@example.com");
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const claims = jwt.decode(device.accessToken) as { sid: string; sub: string };
    const before = await prisma.authSession.findUniqueOrThrow({ where: { id: claims.sid } });
    const refreshed = await api().post("/api/auth/refresh").send({ refreshToken: device.refreshToken }).expect(201);
    expect(jwt.decode(refreshed.body.accessToken)).toMatchObject({ sid: claims.sid });
    const after = await prisma.authSession.findUniqueOrThrow({ where: { id: claims.sid } });
    expect(after.expiresAt).toEqual(before.expiresAt);
    await prisma.authSession.update({ where: { id: claims.sid }, data: { expiresAt: new Date(0) } });
    await api().get("/api/auth/me").auth(device.accessToken, { type: "bearer" }).expect(401);
    await api().post("/api/auth/refresh").send({ refreshToken: device.refreshToken }).expect(401);
    const legacy = jwt.sign({ sub: claims.sub });
    await api().get("/api/auth/me").auth(legacy, { type: "bearer" }).expect(401);
  });


  it("refresh racing logout never creates a new usable session", async () => {
    const device = await loginAs(app, "recovery@example.com");
    const before = await prisma.authSession.count();
    const [, refreshed] = await Promise.all([
      api().post("/api/auth/logout").auth(device.accessToken, { type: "bearer" }),
      api().post("/api/auth/refresh").send({ refreshToken: device.refreshToken }),
    ]);
    expect([201, 401]).toContain(refreshed.status);
    if (refreshed.status === 201) {
      await api().get("/api/auth/me").auth(refreshed.body.accessToken, { type: "bearer" }).expect(401);
      await api().post("/api/auth/refresh").send({ refreshToken: refreshed.body.refreshToken }).expect(401);
    }
    expect(await prisma.authSession.count()).toBe(before);
  });

  it("rejects a login session issued with an old password version", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "recovery@example.com" } });
    await prisma.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
    // Models a login whose password comparison started before the version update.
    const session = await prisma.authSession.create({ data: {
      userId: user.id, authVersion: user.authVersion, expiresAt: new Date(Date.now() + 60_000),
    } });
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const token = jwt.sign({ sub: user.id, sid: session.id, type: "access" });
    await api().get("/api/auth/me").auth(token, { type: "bearer" }).expect(401);
  });

  it("rate limits both request and reset attempts", async () => {
    const previous = process.env.THROTTLE_DISABLED;
    process.env.THROTTLE_DISABLED = "false";
    try {
      for (let i = 0; i < 5; i++) {
        await api().post("/api/auth/forgot-password").send({ email: "unknown@example.com" }).expect(201);
      }
      await api().post("/api/auth/forgot-password").send({ email: "unknown@example.com" }).expect(429);
      for (let i = 0; i < 10; i++) await reset("invalid").expect(400);
      await reset("invalid").expect(429);
    } finally { process.env.THROTTLE_DISABLED = previous; }
  });
});

