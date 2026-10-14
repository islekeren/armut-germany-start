import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UploadFolder } from "./upload-policy";

export async function assertOwnedUploads(
  prisma: PrismaService,
  ownerId: string,
  keys: string[] | undefined,
  folder: UploadFolder,
) {
  if (!keys?.length) return;
  const unique = [...new Set(keys)];
  if (
    unique.length > 20 ||
    unique.some((key) => !key.startsWith(`${folder}/${ownerId}/`))
  )
    throw new ForbiddenException("Invalid private upload references");
  const assets = await prisma.uploadAsset.findMany({
    where: { key: { in: unique }, ownerId, folder, status: "ready" },
    select: { key: true },
  });
  if (assets.length !== unique.length)
    throw new ForbiddenException(
      "Private uploads must be verified and owned by the caller",
    );
}
