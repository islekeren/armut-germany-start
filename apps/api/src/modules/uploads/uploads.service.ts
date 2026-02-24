import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export enum UploadFolder {
  PROFILES = "profiles",
  PORTFOLIOS = "portfolios",
  DOCUMENTS = "documents",
  REQUESTS = "requests",
  MESSAGES = "messages",
}

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    // Configure for Cloudflare R2 or AWS S3
    const endpoint = this.configService.get("S3_ENDPOINT");
    const region = this.configService.get("S3_REGION") || "auto";
    const accessKeyId = this.configService.get("S3_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get("S3_SECRET_ACCESS_KEY");

    this.bucket = this.configService.get("S3_BUCKET") || "armut-uploads";
    this.publicUrl = this.configService.get("S3_PUBLIC_URL") || "";

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: UploadFolder,
    userId: string
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(file, folder);

    // Generate unique filename
    const ext = file.originalname.split(".").pop();
    const filename = `${uuidv4()}.${ext}`;
    const key = `${folder}/${userId}/${filename}`;

    // Upload to S3/R2
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedBy: userId,
        },
      })
    );

    return {
      key,
      url: this.getPublicUrl(key),
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: UploadFolder,
    userId: string
  ): Promise<UploadResult[]> {
    const results = await Promise.all(
      files.map((file) => this.uploadFile(file, folder, userId))
    );
    return results;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async deleteMultipleFiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.deleteFile(key)));
  }

  async deleteFileForUser(key: string, userId: string): Promise<void> {
    if (!this.isUserOwnedKey(key, userId)) {
      throw new ForbiddenException("Not authorized to delete this file");
    }

    await this.deleteFile(key);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPresignedUploadUrl(
    folder: UploadFolder,
    userId: string,
    filename: string,
    contentType: string
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const ext = filename.split(".").pop();
    const uniqueFilename = `${uuidv4()}.${ext}`;
    const key = `${folder}/${userId}/${uniqueFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    return {
      uploadUrl,
      key,
      publicUrl: this.getPublicUrl(key),
    };
  }

  private getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  private validateFile(file: Express.Multer.File, folder: UploadFolder): void {
    const maxSizes: Record<UploadFolder, number> = {
      [UploadFolder.PROFILES]: 5 * 1024 * 1024, // 5MB
      [UploadFolder.PORTFOLIOS]: 10 * 1024 * 1024, // 10MB
      [UploadFolder.DOCUMENTS]: 20 * 1024 * 1024, // 20MB
      [UploadFolder.REQUESTS]: 10 * 1024 * 1024, // 10MB
      [UploadFolder.MESSAGES]: 10 * 1024 * 1024, // 10MB
    };

    const allowedMimeTypes: Record<UploadFolder, string[]> = {
      [UploadFolder.PROFILES]: ["image/jpeg", "image/png", "image/webp"],
      [UploadFolder.PORTFOLIOS]: ["image/jpeg", "image/png", "image/webp"],
      [UploadFolder.DOCUMENTS]: [
        "image/jpeg",
        "image/png",
        "application/pdf",
        "image/webp",
      ],
      [UploadFolder.REQUESTS]: ["image/jpeg", "image/png", "image/webp"],
      [UploadFolder.MESSAGES]: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ],
    };

    if (file.size > maxSizes[folder]) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${maxSizes[folder] / 1024 / 1024}MB)`
      );
    }

    if (!allowedMimeTypes[folder].includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${allowedMimeTypes[folder].join(", ")}`
      );
    }
  }

  private isUserOwnedKey(key: string, userId: string): boolean {
    return Object.values(UploadFolder).some((folder) =>
      key.startsWith(`${folder}/${userId}/`)
    );
  }
}
