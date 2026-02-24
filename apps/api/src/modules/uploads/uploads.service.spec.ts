import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UploadFolder, UploadsService } from "./uploads.service";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "uuid-123"),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

describe("UploadsService", () => {
  const createConfigService = (publicUrl = "https://cdn.example.com") =>
    ({
      get: jest.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
          S3_REGION: "auto",
          S3_ACCESS_KEY_ID: "ak",
          S3_SECRET_ACCESS_KEY: "sk",
          S3_BUCKET: "armut-test",
          S3_PUBLIC_URL: publicUrl,
        };
        return values[key];
      }),
    }) as any;

  const file = {
    originalname: "avatar.png",
    mimetype: "image/png",
    size: 1024,
    buffer: Buffer.from("file"),
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads file and returns metadata", async () => {
    const service = new UploadsService(createConfigService());
    const sendSpy = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);

    await expect(
      service.uploadFile(file, UploadFolder.PROFILES, "user-1")
    ).resolves.toEqual({
      key: "profiles/user-1/uuid-123.png",
      url: "https://cdn.example.com/profiles/user-1/uuid-123.png",
      filename: "avatar.png",
      mimetype: "image/png",
      size: 1024,
    });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects file larger than folder limit", async () => {
    const service = new UploadsService(createConfigService());
    const large = { ...file, size: 6 * 1024 * 1024 };

    await expect(
      service.uploadFile(large, UploadFolder.PROFILES, "user-1")
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects file type not allowed for folder", async () => {
    const service = new UploadsService(createConfigService());
    const invalid = { ...file, mimetype: "application/pdf" };

    await expect(
      service.uploadFile(invalid, UploadFolder.PROFILES, "user-1")
    ).rejects.toThrow(BadRequestException);
  });

  it("uploads multiple files", async () => {
    const service = new UploadsService(createConfigService());
    const uploadSpy = jest
      .spyOn(service, "uploadFile")
      .mockResolvedValue({
        key: "k1",
        url: "u1",
        filename: "f",
        mimetype: "image/png",
        size: 1,
      });

    await expect(
      service.uploadMultipleFiles([file, file], UploadFolder.PORTFOLIOS, "user-1")
    ).resolves.toEqual([
      { key: "k1", url: "u1", filename: "f", mimetype: "image/png", size: 1 },
      { key: "k1", url: "u1", filename: "f", mimetype: "image/png", size: 1 },
    ]);
    expect(uploadSpy).toHaveBeenCalledTimes(2);
  });

  it("deletes a single file", async () => {
    const service = new UploadsService(createConfigService());
    const sendSpy = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);

    await service.deleteFile("profiles/user-1/file.png");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("deletes multiple files", async () => {
    const service = new UploadsService(createConfigService());
    const deleteSpy = jest.spyOn(service, "deleteFile").mockResolvedValue();

    await service.deleteMultipleFiles(["k1", "k2"]);
    expect(deleteSpy).toHaveBeenCalledWith("k1");
    expect(deleteSpy).toHaveBeenCalledWith("k2");
  });

  it("rejects delete when key is not user-owned", async () => {
    const service = new UploadsService(createConfigService());
    await expect(
      service.deleteFileForUser("profiles/other/file.png", "user-1")
    ).rejects.toThrow(ForbiddenException);
  });

  it("deletes user-owned key", async () => {
    const service = new UploadsService(createConfigService());
    const deleteSpy = jest.spyOn(service, "deleteFile").mockResolvedValue();

    await service.deleteFileForUser("profiles/user-1/file.png", "user-1");
    expect(deleteSpy).toHaveBeenCalledWith("profiles/user-1/file.png");
  });

  it("returns signed download url", async () => {
    const service = new UploadsService(createConfigService());
    (getSignedUrl as jest.Mock).mockResolvedValue("https://signed/download");

    await expect(service.getSignedUrl("profiles/user-1/file.png", 600)).resolves.toBe(
      "https://signed/download"
    );
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("returns signed upload url and public url", async () => {
    const service = new UploadsService(createConfigService());
    (getSignedUrl as jest.Mock).mockResolvedValue("https://signed/upload");

    await expect(
      service.getPresignedUploadUrl(
        UploadFolder.DOCUMENTS,
        "user-1",
        "doc.pdf",
        "application/pdf"
      )
    ).resolves.toEqual({
      uploadUrl: "https://signed/upload",
      key: "documents/user-1/uuid-123.pdf",
      publicUrl: "https://cdn.example.com/documents/user-1/uuid-123.pdf",
    });
  });

  it("falls back to default S3 public url format when S3_PUBLIC_URL is missing", async () => {
    const service = new UploadsService(createConfigService(""));
    const sendSpy = jest
      .spyOn((service as any).s3Client, "send")
      .mockResolvedValue({} as never);

    const result = await service.uploadFile(file, UploadFolder.PROFILES, "user-1");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(result.url).toBe(
      "https://armut-test.s3.amazonaws.com/profiles/user-1/uuid-123.png"
    );
  });
});
