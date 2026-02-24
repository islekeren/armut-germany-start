import { BadRequestException } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { UploadFolder } from "./uploads.service";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "uuid-123"),
}));

describe("UploadsController", () => {
  const uploadsService = {
    uploadFile: jest.fn(),
    uploadMultipleFiles: jest.fn(),
    getPresignedUploadUrl: jest.fn(),
    deleteFileForUser: jest.fn(),
  };

  let controller: UploadsController;

  const req = { user: { id: "u1" } };
  const file = {
    originalname: "test.png",
    mimetype: "image/png",
    size: 1000,
    buffer: Buffer.from("a"),
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UploadsController(uploadsService as any);
  });

  it("throws for missing profile file", async () => {
    await expect(controller.uploadProfileImage(undefined as any, req)).rejects.toThrow(
      new BadRequestException("No file provided")
    );
  });

  it("uploads profile image", async () => {
    uploadsService.uploadFile.mockResolvedValue({ key: "k1" });
    await expect(controller.uploadProfileImage(file, req)).resolves.toEqual({
      key: "k1",
    });
    expect(uploadsService.uploadFile).toHaveBeenCalledWith(
      file,
      UploadFolder.PROFILES,
      "u1"
    );
  });

  it("throws for missing portfolio files", async () => {
    await expect(controller.uploadPortfolioImages([], req)).rejects.toThrow(
      new BadRequestException("No files provided")
    );
  });

  it("uploads portfolio files", async () => {
    uploadsService.uploadMultipleFiles.mockResolvedValue([{ key: "k1" }]);
    await expect(controller.uploadPortfolioImages([file], req)).resolves.toEqual([
      { key: "k1" },
    ]);
    expect(uploadsService.uploadMultipleFiles).toHaveBeenCalledWith(
      [file],
      UploadFolder.PORTFOLIOS,
      "u1"
    );
  });

  it("throws for missing document files", async () => {
    await expect(controller.uploadDocuments(undefined as any, req)).rejects.toThrow(
      new BadRequestException("No files provided")
    );
  });

  it("uploads documents", async () => {
    uploadsService.uploadMultipleFiles.mockResolvedValue([{ key: "k2" }]);
    await expect(controller.uploadDocuments([file], req)).resolves.toEqual([
      { key: "k2" },
    ]);
    expect(uploadsService.uploadMultipleFiles).toHaveBeenCalledWith(
      [file],
      UploadFolder.DOCUMENTS,
      "u1"
    );
  });

  it("throws for missing request files", async () => {
    await expect(controller.uploadRequestImages(undefined as any, req)).rejects.toThrow(
      new BadRequestException("No files provided")
    );
  });

  it("uploads request files", async () => {
    uploadsService.uploadMultipleFiles.mockResolvedValue([{ key: "k3" }]);
    await expect(controller.uploadRequestImages([file], req)).resolves.toEqual([
      { key: "k3" },
    ]);
    expect(uploadsService.uploadMultipleFiles).toHaveBeenCalledWith(
      [file],
      UploadFolder.REQUESTS,
      "u1"
    );
  });

  it("throws for missing message files", async () => {
    await expect(
      controller.uploadMessageAttachments(undefined as any, req)
    ).rejects.toThrow(new BadRequestException("No files provided"));
  });

  it("uploads message files", async () => {
    uploadsService.uploadMultipleFiles.mockResolvedValue([{ key: "k4" }]);
    await expect(controller.uploadMessageAttachments([file], req)).resolves.toEqual([
      { key: "k4" },
    ]);
    expect(uploadsService.uploadMultipleFiles).toHaveBeenCalledWith(
      [file],
      UploadFolder.MESSAGES,
      "u1"
    );
  });

  it("returns presigned upload url", async () => {
    uploadsService.getPresignedUploadUrl.mockResolvedValue({
      uploadUrl: "https://upload",
      key: "k5",
      publicUrl: "https://public/k5",
    });

    await expect(
      controller.getPresignedUploadUrl(
        {
          folder: UploadFolder.DOCUMENTS,
          filename: "doc.pdf",
          contentType: "application/pdf",
        },
        req
      )
    ).resolves.toEqual({
      uploadUrl: "https://upload",
      key: "k5",
      publicUrl: "https://public/k5",
    });
    expect(uploadsService.getPresignedUploadUrl).toHaveBeenCalledWith(
      UploadFolder.DOCUMENTS,
      "u1",
      "doc.pdf",
      "application/pdf"
    );
  });

  it("deletes user-owned file with decoded key", async () => {
    uploadsService.deleteFileForUser.mockResolvedValue(undefined);
    const result = await controller.deleteFile("profiles%2Fu1%2Ftest.png", req);
    expect(uploadsService.deleteFileForUser).toHaveBeenCalledWith(
      "profiles/u1/test.png",
      "u1"
    );
    expect(result).toEqual({ success: true });
  });
});
