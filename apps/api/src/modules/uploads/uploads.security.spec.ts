import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Readable } from "node:stream";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UploadsService } from "./uploads.service";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("signed"),
}));
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

describe("private reads and quarantine", () => {
  const asset = {
    id: "asset",
    key: "documents/u1/asset.png",
    folder: "documents",
    ownerId: "u1",
    status: "ready",
    mimetype: "image/png",
    filename: "x.png",
    size: PNG.length,
    expiresAt: new Date(Date.now() + 60000),
  };
  let service: UploadsService;
  let prisma: any;
  let send: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      uploadAsset: {
        findUnique: jest.fn().mockResolvedValue(asset),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(asset),
      },
      message: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new (UploadsService as any)(
      {
        get: (key: string) =>
          ({ S3_BUCKET: "public", S3_PRIVATE_BUCKET: "private" })[key],
      },
      prisma,
    );
    send = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);
  });
  it("does not sign a document for an unrelated user", async () => {
    await expect(
      (service as any).getPrivateReadUrl(asset.key, {
        id: "u2",
        userType: "customer",
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it.each([
    { id: "u1", userType: "provider" },
    { id: "admin", userType: "admin" },
  ])("signs owner/admin documents for five minutes", async (user) => {
    await expect(
      (service as any).getPrivateReadUrl(asset.key, user),
    ).resolves.toEqual({ url: "signed", expiresIn: 300 });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "private",
          ResponseContentDisposition: "attachment",
        }),
      }),
      { expiresIn: 300 },
    );
  });
  it("requires conversation membership for message reads even for admins", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      folder: "messages",
    });
    await expect(
      (service as any).getPrivateReadUrl(asset.key, {
        id: "admin",
        userType: "admin",
      }),
    ).rejects.toThrow(ForbiddenException);
    prisma.message.findFirst.mockResolvedValue({ id: "message" });
    await expect(
      (service as any).getPrivateReadUrl(asset.key, {
        id: "u2",
        userType: "customer",
      }),
    ).resolves.toHaveProperty("url");
    expect(prisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          attachments: { has: asset.key },
          conversation: { participants: { some: { userId: "u2" } } },
        },
      }),
    );
  });
  it("never signs an unverified asset", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      status: "pending",
    });
    await expect(
      (service as any).getPrivateReadUrl(asset.key, {
        id: "u1",
        userType: "provider",
      }),
    ).rejects.toThrow();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it("rejects foreign and expired finalize attempts before storage", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      status: "pending",
    });
    await expect(
      (service as any).finalizeUpload(asset.key, "u2"),
    ).rejects.toThrow(ForbiddenException);
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      status: "pending",
      expiresAt: new Date(0),
    });
    await expect(
      (service as any).finalizeUpload(asset.key, "u1"),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects a forged PNG from quarantine without publishing it", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      key: "quarantine/u1/asset",
      status: "pending",
    });
    send.mockResolvedValue({
      ContentLength: 4,
      Body: Readable.from([Buffer.from("html")]),
    });
    await expect(
      (service as any).finalizeUpload("quarantine/u1/asset", "u1"),
    ).rejects.toThrow(BadRequestException);
    expect(
      send.mock.calls.some(
        ([command]) => command.constructor.name === "PutObjectCommand",
      ),
    ).toBe(false);
  });
  it("does not buffer an oversized quarantine object", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      key: "quarantine/u1/asset",
      status: "pending",
    });
    const body = Readable.from([PNG]);
    const destroy = jest.spyOn(body, "destroy");
    send.mockResolvedValue({ ContentLength: 21 * 1024 * 1024, Body: body });
    await expect(
      (service as any).finalizeUpload("quarantine/u1/asset", "u1"),
    ).rejects.toThrow();
    expect(destroy).toHaveBeenCalled();
  });
  it("refuses to delete an object while finalization owns its state", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      key: "quarantine/u1/asset",
      status: "processing",
    });
    prisma.uploadAsset.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.deleteFileForUser("quarantine/u1/asset", "u1"),
    ).rejects.toThrow("Upload is being finalized");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not resurrect a record when deletion wins before publication", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      key: "quarantine/u1/asset",
      status: "pending",
    });
    send.mockResolvedValue({
      ContentLength: PNG.length,
      Body: Readable.from([PNG]),
    });
    prisma.uploadAsset.update.mockImplementation(({ where }) => {
      if (where.status === "processing") throw new Error("State changed");
      return Promise.resolve(asset);
    });
    await expect(
      (service as any).finalizeUpload("quarantine/u1/asset", "u1"),
    ).rejects.toThrow("State changed");
    expect(
      send.mock.calls.some(
        ([command]) =>
          command.constructor.name === "DeleteObjectCommand" &&
          command.input.Key === asset.key,
      ),
    ).toBe(true);
  });

  it("finalizes validated content into a distinct canonical destination", async () => {
    prisma.uploadAsset.findUnique.mockResolvedValue({
      ...asset,
      key: "quarantine/u1/asset",
      status: "pending",
    });
    send.mockResolvedValue({
      ContentLength: PNG.length,
      Body: Readable.from([PNG]),
    });
    const result = await (service as any).finalizeUpload(
      "quarantine/u1/asset",
      "u1",
    );
    expect(result.key).toBe("documents/u1/asset.png");
    expect(result.url).toBe(result.key);
    expect(
      send.mock.calls.some(
        ([command]) =>
          command.constructor.name === "PutObjectCommand" &&
          command.input.Bucket === "private",
      ),
    ).toBe(true);
  });
});
