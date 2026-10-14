import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UploadFolder, UploadsService } from "./uploads.service";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const prisma: any = {
  $queryRaw: jest.fn().mockResolvedValue([{ id: "user-1" }]),
  uploadAsset: {
    findUnique: jest.fn().mockResolvedValue(null),
    aggregate: jest.fn().mockResolvedValue({ _count: 0, _sum: { size: 0 } }),
    create: jest.fn().mockImplementation(({ data }) => data),
    update: jest.fn().mockImplementation(({ data, where }) => ({
      id: where.id,
      ownerId: "user-1",
      folder: "profiles",
      filename: "avatar.png",
      ...data,
    })),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
};
const mockUuid = "11111111-1111-4111-8111-111111111111";

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn(() => "11111111-1111-4111-8111-111111111111"),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

describe("UploadsService", () => {
  const createConfigService = (
    publicUrl = "https://cdn.example.com",
    privateBucket = "",
  ) =>
    ({
      get: jest.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
          S3_REGION: "auto",
          S3_ACCESS_KEY_ID: "ak",
          S3_SECRET_ACCESS_KEY: "sk",
          S3_BUCKET: "machma-test",
          S3_PRIVATE_BUCKET: privateBucket,
          S3_PUBLIC_URL: publicUrl,
        };
        return values[key];
      }),
    }) as any;

  const file = {
    originalname: "avatar.png",
    mimetype: "image/png",
    size: PNG.length,
    buffer: PNG,
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.uploadAsset.findUnique.mockResolvedValue(null);
    prisma.uploadAsset.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { size: 0 },
    });
  });

  it("rejects HTML labelled as PNG before writing storage", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const send = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);
    await expect(
      service.uploadFile(
        { ...file, buffer: Buffer.from("<html>") },
        UploadFolder.PROFILES,
        "user-1",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed for private uploads without a separate private bucket", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);
    await expect(
      service.uploadFile(file, UploadFolder.DOCUMENTS, "user-1"),
    ).rejects.toThrow("Private upload storage is not configured");
  });

  it("never exposes a public URL for unverified presigned content", async () => {
    const service = new UploadsService(
      createConfigService(undefined, "private"),
      prisma,
    );
    (getSignedUrl as jest.Mock).mockResolvedValue("https://signed/upload");
    const result = await service.getPresignedUploadUrl(
      UploadFolder.PROFILES,
      "user-1",
      "x.png",
      "image/png",
    );
    expect(result).not.toHaveProperty("publicUrl");
    expect(result.key).toMatch(/^quarantine\//);
  });

  it.each(["requests", "daily-bytes", "live-bytes"])(
    "rejects exceeded %s account allowances without writing storage",
    async (bound) => {
      const service = new UploadsService(createConfigService(), prisma);
      const send = jest
        .spyOn((service as any).s3Client, "send")
        .mockResolvedValue({} as never);
      prisma.uploadAsset.aggregate.mockImplementation(({ where }) =>
        where.createdAt
          ? Promise.resolve({
              _count: bound === "requests" ? 100 : 0,
              _sum: { size: bound === "daily-bytes" ? 200 * 1024 * 1024 : 0 },
            })
          : Promise.resolve({
              _sum: { size: bound === "live-bytes" ? 1024 * 1024 * 1024 : 0 },
            }),
      );
      await expect(
        service.uploadFile(file, UploadFolder.PROFILES, "user-1"),
      ).rejects.toThrow("Account upload allowance exceeded");
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("retains live allowance after a failed deletion and permits retry", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const key = `profiles/user-1/${mockUuid}.png`;
    let status = "ready";
    prisma.uploadAsset.findUnique.mockResolvedValue({
      id: mockUuid,
      key,
      status,
    });
    prisma.uploadAsset.updateMany.mockImplementation(({ data }) => {
      if (data.status === "deleting" || data.status === "deleted")
        status = data.status;
      return Promise.resolve({ count: 1 });
    });
    const send = jest
      .spyOn((service as any).s3Client, "send")
      .mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(service.deleteFileForUser(key, "user-1")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(status).toBe("deleting");
    prisma.uploadAsset.aggregate.mockImplementation(({ where }) =>
      Promise.resolve({
        _count: 0,
        _sum: {
          size: where.status?.in.includes(status) ? 1024 * 1024 * 1024 : 0,
        },
      }),
    );
    await expect(
      service.uploadFile(file, UploadFolder.PROFILES, "user-1"),
    ).rejects.toThrow("Account upload allowance exceeded");
    send.mockResolvedValue({} as never);
    await service.deleteFileForUser(key, "user-1");
    expect(status).toBe("deleted");
  });

  it("uploads file and returns metadata", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const sendSpy = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);

    await expect(
      service.uploadFile(file, UploadFolder.PROFILES, "user-1"),
    ).resolves.toEqual({
      key: `profiles/user-1/${mockUuid}.png`,
      url: `https://cdn.example.com/profiles/user-1/${mockUuid}.png`,
      filename: "avatar.png",
      mimetype: "image/png",
      size: expect.any(Number),
    });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects file larger than folder limit", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const large = {
      ...file,
      size: 6 * 1024 * 1024,
      buffer: Buffer.alloc(6 * 1024 * 1024),
    };

    await expect(
      service.uploadFile(large, UploadFolder.PROFILES, "user-1"),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects file type not allowed for folder", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const invalid = { ...file, mimetype: "application/pdf" };

    await expect(
      service.uploadFile(invalid, UploadFolder.PROFILES, "user-1"),
    ).rejects.toThrow(BadRequestException);
  });

  it("uploads multiple files", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const uploadSpy = jest.spyOn(service, "uploadFile").mockResolvedValue({
      key: "k1",
      url: "u1",
      filename: "f",
      mimetype: "image/png",
      size: 1,
    });

    await expect(
      service.uploadMultipleFiles(
        [file, file],
        UploadFolder.PORTFOLIOS,
        "user-1",
      ),
    ).resolves.toEqual([
      { key: "k1", url: "u1", filename: "f", mimetype: "image/png", size: 1 },
      { key: "k1", url: "u1", filename: "f", mimetype: "image/png", size: 1 },
    ]);
    expect(uploadSpy).toHaveBeenCalledTimes(2);
  });

  it("deletes a single file", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const sendSpy = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);

    await service.deleteFile("profiles/user-1/file.png");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("deletes multiple files", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const deleteSpy = jest.spyOn(service, "deleteFile").mockResolvedValue();

    await service.deleteMultipleFiles(["k1", "k2"]);
    expect(deleteSpy).toHaveBeenCalledWith("k1");
    expect(deleteSpy).toHaveBeenCalledWith("k2");
  });

  it("rejects delete when key is not user-owned", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    await expect(
      service.deleteFileForUser("profiles/other/file.png", "user-1"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("deletes user-owned key", async () => {
    const service = new UploadsService(createConfigService(), prisma);
    const deleteSpy = jest.spyOn(service, "deleteFile").mockResolvedValue();

    await service.deleteFileForUser("profiles/user-1/file.png", "user-1");
    expect(deleteSpy).toHaveBeenCalledWith("profiles/user-1/file.png");
  });

  it("signs only a quarantine PUT in the separate private bucket", async () => {
    const service = new UploadsService(
      createConfigService(undefined, "private"),
      prisma,
    );
    (getSignedUrl as jest.Mock).mockResolvedValue("https://signed/upload");
    await expect(
      service.getPresignedUploadUrl(
        UploadFolder.DOCUMENTS,
        "user-1",
        "doc.pdf",
        "application/pdf",
      ),
    ).resolves.toEqual({
      uploadUrl: "https://signed/upload",
      key: `quarantine/user-1/${mockUuid}`,
      expiresIn: 600,
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: "private" }),
      }),
      { expiresIn: 600 },
    );
  });

  it("rejects presigned uploads outside the folder's allowed types", async () => {
    const service = new UploadsService(
      createConfigService(undefined, "private"),
      prisma,
    );

    await expect(
      service.getPresignedUploadUrl(
        UploadFolder.PROFILES,
        "user-1",
        "page.html",
        "text/html",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("falls back to default S3 public url format when S3_PUBLIC_URL is missing", async () => {
    const service = new UploadsService(createConfigService(""), prisma);
    const sendSpy = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);

    const result = await service.uploadFile(
      file,
      UploadFolder.PROFILES,
      "user-1",
    );
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(result.url).toBe(
      `https://machma-test.s3.amazonaws.com/profiles/user-1/${mockUuid}.png`,
    );
  });
});
