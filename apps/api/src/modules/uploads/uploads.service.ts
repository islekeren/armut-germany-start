import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { Readable, addAbortSignal } from "node:stream";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UploadAsset } from "@prisma/client";
import {
  UploadFolder,
  MAX_FILE_SIZES,
  EXTENSIONS,
  allowedTypes,
  isPrivateFolder,
  MIB,
} from "./upload-policy";
import { validateUploadContent } from "./upload-content";
export { UploadFolder } from "./upload-policy";

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}
const UPLOAD_TTL = 600;
const READ_TTL = 300;

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucket: string;
  private privateBucket: string;
  private publicUrl: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.bucket = configService.get("S3_BUCKET") || "armut-uploads";
    this.privateBucket = configService.get("S3_PRIVATE_BUCKET") || "";
    this.publicUrl = configService.get("S3_PUBLIC_URL") || "";
    this.s3Client = new S3Client({
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
      endpoint: configService.get("S3_ENDPOINT"),
      region: configService.get("S3_REGION") || "auto",
      forcePathStyle: configService.get("S3_FORCE_PATH_STYLE") === "true",
      credentials: {
        accessKeyId: configService.get("S3_ACCESS_KEY_ID") || "",
        secretAccessKey: configService.get("S3_SECRET_ACCESS_KEY") || "",
      },
    });
  }

  private requirePrivateBucket() {
    if (!this.privateBucket || this.privateBucket === this.bucket)
      throw new ServiceUnavailableException(
        "Private upload storage is not configured",
      );
    return this.privateBucket;
  }
  private bucketFor(folder: UploadFolder) {
    return isPrivateFolder(folder) ? this.requirePrivateBucket() : this.bucket;
  }

  /** User-row locking makes allowances consistent across processes and concurrent requests. */
  private async reserve(
    folder: UploadFolder,
    userId: string,
    filename: string,
    mimetype: string,
    size: number,
  ) {
    const id = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "User" WHERE "id" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!active.length) throw new ForbiddenException("Account is inactive");
      const now = new Date();
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      // Expired reservations never become readable; bucket lifecycle removes staging objects.
      await tx.uploadAsset.updateMany({
        where: { ownerId: userId, status: "pending", expiresAt: { lt: now } },
        data: { status: "rejected" },
      });
      const daily = await tx.uploadAsset.aggregate({
        where: { ownerId: userId, createdAt: { gte: since } },
        _count: true,
        _sum: { size: true },
      });
      const live = await tx.uploadAsset.aggregate({
        where: {
          ownerId: userId,
          status: { in: ["pending", "processing", "deleting", "ready"] },
        },
        _sum: { size: true },
      });
      if (
        daily._count >= 100 ||
        (daily._sum.size ?? 0) + size > 200 * MIB ||
        (live._sum.size ?? 0) + size > 1024 * MIB
      ) {
        throw new HttpException("Account upload allowance exceeded", 429);
      }
      return tx.uploadAsset.create({
        data: {
          id,
          ownerId: userId,
          folder,
          key: `quarantine/${userId}/${id}`,
          filename: filename.slice(0, 255),
          mimetype,
          size,
          expiresAt: new Date(now.getTime() + UPLOAD_TTL * 1000),
        },
      });
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: UploadFolder,
    userId: string,
  ): Promise<UploadResult> {
    this.bucketFor(folder);
    if (
      !allowedTypes(folder).includes(file.mimetype) ||
      !file.buffer.length ||
      file.buffer.length > MAX_FILE_SIZES[folder]
    ) {
      throw new BadRequestException("File size or type is not allowed");
    }
    // Charge accepted attempts before decoding so spoofed/invalid content cannot bypass the allowance.
    const asset = await this.reserve(
      folder,
      userId,
      file.originalname,
      file.mimetype,
      MAX_FILE_SIZES[folder],
    );
    try {
      const validated = await validateUploadContent(
        file.buffer,
        file.mimetype,
        folder,
      );
      return await this.publish(asset, validated);
    } catch (error) {
      await this.prisma.uploadAsset.updateMany({
        where: { id: asset.id, status: { in: ["pending", "processing"] } },
        data: { status: "rejected" },
      });
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: UploadFolder,
    userId: string,
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files)
      results.push(await this.uploadFile(file, folder, userId));
    return results;
  }

  private async publish(
    asset: UploadAsset,
    validated: { buffer: Buffer; mimetype: string },
  ) {
    const folder = asset.folder as UploadFolder;
    const key = `${folder}/${asset.ownerId}/${asset.id}.${EXTENSIONS[validated.mimetype]}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketFor(folder),
        Key: key,
        Body: validated.buffer,
        ContentType: validated.mimetype,
        ...(isPrivateFolder(folder)
          ? {
              ContentDisposition: "attachment",
              CacheControl: "private, no-store",
            }
          : {}),
      }),
    );
    // Persist readiness only after storage acknowledges the verified bytes.
    let ready: UploadAsset;
    try {
      ready = await this.prisma.uploadAsset.update({
        where: { id: asset.id, status: asset.status },
        data: { key, status: "ready", mimetype: validated.mimetype },
      });
    } catch (error) {
      // A failed readiness write must not leave a public orphan behind.
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucketFor(folder), Key: key }),
      );
      throw error;
    }
    return this.result(ready, validated.buffer.length);
  }

  private result(asset: UploadAsset, size = asset.size): UploadResult {
    return {
      key: asset.key,
      url: isPrivateFolder(asset.folder as UploadFolder)
        ? asset.key
        : this.getPublicUrl(asset.key),
      filename: asset.filename,
      mimetype: asset.mimetype,
      size,
    };
  }

  async getPresignedUploadUrl(
    folder: UploadFolder,
    userId: string,
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
    const bucket = this.requirePrivateBucket();
    if (!allowedTypes(folder).includes(contentType))
      throw new BadRequestException("File type not allowed");
    const asset = await this.reserve(
      folder,
      userId,
      filename,
      contentType,
      MAX_FILE_SIZES[folder],
    );
    const uploadUrl = await getSignedUrl(
      this.s3Client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: asset.key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_TTL },
    );
    return { uploadUrl, key: asset.key, expiresIn: UPLOAD_TTL };
  }

  async finalizeUpload(key: string, userId: string): Promise<UploadResult> {
    this.requirePrivateBucket();
    const asset = await this.prisma.uploadAsset.findUnique({ where: { key } });
    if (!asset || asset.ownerId !== userId)
      throw new ForbiddenException("Not authorized to finalize this upload");
    if (asset.status !== "pending" || asset.expiresAt <= new Date())
      throw new BadRequestException("Upload is expired or already finalized");
    const claimed = await this.prisma.uploadAsset.updateMany({
      where: { id: asset.id, status: "pending" },
      data: { status: "processing" },
    });
    if (!claimed.count)
      throw new BadRequestException("Upload is already being finalized");
    try {
      const object = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.privateBucket, Key: key }),
      );
      const limit = MAX_FILE_SIZES[asset.folder as UploadFolder];
      if (!(object.Body instanceof Readable))
        throw new BadRequestException("Upload has no content");
      if ((object.ContentLength ?? 0) > limit) {
        object.Body.destroy();
        throw new BadRequestException("Upload exceeds maximum file size");
      }
      addAbortSignal(AbortSignal.timeout(30_000), object.Body);
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of object.Body) {
        size += chunk.length;
        if (size > limit) {
          object.Body.destroy();
          throw new BadRequestException("Upload exceeds maximum file size");
        }
        chunks.push(Buffer.from(chunk));
      }
      const validated = await validateUploadContent(
        Buffer.concat(chunks),
        asset.mimetype,
        asset.folder as UploadFolder,
      );
      return await this.publish({ ...asset, status: "processing" }, validated);
    } catch (error) {
      await this.prisma.uploadAsset.updateMany({
        where: { id: asset.id, status: { in: ["pending", "processing"] } },
        data: { status: "rejected" },
      });
      throw error;
    } finally {
      // Never promote or copy staging bytes. Late PUTs can only recreate private quarantine;
      // lifecycle expires them, and the consumed record cannot be finalized twice.
      await this.s3Client
        .send(new DeleteObjectCommand({ Bucket: this.privateBucket, Key: key }))
        .catch(() => undefined);
    }
  }

  async getPrivateReadUrl(key: string, user: { id: string; userType: string }) {
    this.requirePrivateBucket();
    const asset = await this.prisma.uploadAsset.findUnique({ where: { key } });
    if (
      !asset ||
      asset.status !== "ready" ||
      !isPrivateFolder(asset.folder as UploadFolder)
    )
      throw new NotFoundException("Private file not found");
    if (asset.folder === UploadFolder.DOCUMENTS) {
      if (asset.ownerId !== user.id && user.userType !== "admin")
        throw new ForbiddenException("Not authorized to read this file");
    } else {
      const message = await this.prisma.message.findFirst({
        where: {
          attachments: { has: key },
          conversation: { participants: { some: { userId: user.id } } },
        },
        select: { id: true },
      });
      if (!message)
        throw new ForbiddenException(
          "Not a participant of this attachment conversation",
        );
    }
    const url = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.privateBucket,
        Key: key,
        ResponseContentDisposition: "attachment",
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: READ_TTL },
    );
    return { url, expiresIn: READ_TTL };
  }

  async deleteFile(key: string): Promise<void> {
    const folder = key.split("/")[0] as UploadFolder;
    const bucket =
      folder === ("quarantine" as UploadFolder)
        ? this.requirePrivateBucket()
        : this.bucketFor(folder);
    const asset = await this.prisma.uploadAsset.findUnique({ where: { key } });
    if (asset) {
      const claimed = await this.prisma.uploadAsset.updateMany({
        where: {
          id: asset.id,
          status: {
            in: ["pending", "ready", "rejected", "deleting", "deleted"],
          },
        },
        data: { status: "deleting" },
      });
      if (!claimed.count)
        throw new ConflictException(
          "Upload is being finalized; retry deletion after finalization",
        );
    }
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
    await this.prisma.uploadAsset.updateMany({
      where: { key, status: "deleting" },
      data: { status: "deleted" },
    });
  }

  async deleteMultipleFiles(keys: string[]) {
    for (const key of keys) await this.deleteFile(key);
  }
  async deleteFileForUser(key: string, userId: string) {
    if (!this.isUserOwnedKey(key, userId))
      throw new ForbiddenException("Not authorized to delete this file");
    await this.deleteFile(key);
  }
  private isUserOwnedKey(key: string, userId: string) {
    return (
      [...Object.values(UploadFolder), "quarantine"].some((folder) =>
        key.startsWith(`${folder}/${userId}/`),
      ) && !key.includes("..")
    );
  }
  private getPublicUrl(key: string) {
    return this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
