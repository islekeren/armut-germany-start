import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { UploadsService, UploadFolder } from "./uploads.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("profile")
  @UseInterceptors(FileInterceptor("file"))
  async uploadProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    return this.uploadsService.uploadFile(
      file,
      UploadFolder.PROFILES,
      req.user.id
    );
  }

  @Post("portfolio")
  @UseInterceptors(FilesInterceptor("files", 10))
  async uploadPortfolioImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.PORTFOLIOS,
      req.user.id
    );
  }

  @Post("document")
  @UseInterceptors(FilesInterceptor("files", 5))
  async uploadDocuments(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.DOCUMENTS,
      req.user.id
    );
  }

  @Post("request")
  @UseInterceptors(FilesInterceptor("files", 5))
  async uploadRequestImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.REQUESTS,
      req.user.id
    );
  }

  @Post("message")
  @UseInterceptors(FilesInterceptor("files", 3))
  async uploadMessageAttachments(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.MESSAGES,
      req.user.id
    );
  }

  @Post("presigned")
  async getPresignedUploadUrl(
    @Body()
    body: {
      folder: UploadFolder;
      filename: string;
      contentType: string;
    },
    @Req() req: any
  ) {
    return this.uploadsService.getPresignedUploadUrl(
      body.folder,
      req.user.id,
      body.filename,
      body.contentType
    );
  }

  @Delete(":key")
  async deleteFile(@Param("key") key: string, @Req() req: any) {
    // Decode the key (it might be URL encoded)
    const decodedKey = decodeURIComponent(key);
    await this.uploadsService.deleteFileForUser(decodedKey, req.user.id);
    return { success: true };
  }
}
