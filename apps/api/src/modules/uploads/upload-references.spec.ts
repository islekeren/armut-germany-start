import { ForbiddenException } from "@nestjs/common";
import { assertOwnedUploads } from "./upload-references";
import { UploadFolder } from "./upload-policy";

describe("private reference ownership", () => {
  it("rejects another owner, unverified content and external URLs", async () => {
    const prisma = {
      uploadAsset: { findMany: jest.fn().mockResolvedValue([]) },
    };
    for (const key of [
      "messages/u2/file.png",
      "quarantine/u1/file",
      "https://public.example/file.png",
    ]) {
      await expect(
        assertOwnedUploads(prisma as any, "u1", [key], UploadFolder.MESSAGES),
      ).rejects.toThrow(ForbiddenException);
    }
  });
  it("accepts only ready records in the requested folder owned by the sender", async () => {
    const key = "messages/u1/file.png";
    const prisma = {
      uploadAsset: { findMany: jest.fn().mockResolvedValue([{ key }]) },
    };
    await assertOwnedUploads(prisma as any, "u1", [key], UploadFolder.MESSAGES);
    expect(prisma.uploadAsset.findMany).toHaveBeenCalledWith({
      where: {
        key: { in: [key] },
        ownerId: "u1",
        folder: "messages",
        status: "ready",
      },
      select: { key: true },
    });
  });
});
