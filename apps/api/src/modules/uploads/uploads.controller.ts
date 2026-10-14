import {
  Controller,
  Post,
  Get,
  Res,
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
import { Response } from "express";
import { FinalizeUploadDto } from "./dto/finalize-upload.dto";
import { UploadRequestBudget, uploadOptions } from "./upload-multipart";
import { PresignedUploadDto } from "./dto/presigned-upload.dto";
import { UploadsService, UploadFolder } from "./uploads.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("profile")
  @UseInterceptors(
    UploadRequestBudget,
    FileInterceptor("file", uploadOptions(UploadFolder.PROFILES, 1)),
  )
  async uploadProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    return this.uploadsService.uploadFile(
      file,
      UploadFolder.PROFILES,
      req.user.id,
    );
  }

  @Post("portfolio")
  @UseInterceptors(
    UploadRequestBudget,
    FilesInterceptor("files", 10, uploadOptions(UploadFolder.PORTFOLIOS, 10)),
  )
  async uploadPortfolioImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.PORTFOLIOS,
      req.user.id,
    );
  }

  @Post("document")
  @UseInterceptors(
    UploadRequestBudget,
    FilesInterceptor("files", 5, uploadOptions(UploadFolder.DOCUMENTS, 5)),
  )
  async uploadDocuments(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.DOCUMENTS,
      req.user.id,
    );
  }

  @Post("request")
  @UseInterceptors(
    UploadRequestBudget,
    FilesInterceptor("files", 5, uploadOptions(UploadFolder.REQUESTS, 5)),
  )
  async uploadRequestImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.REQUESTS,
      req.user.id,
    );
  }

  @Post("message")
  @UseInterceptors(
    UploadRequestBudget,
    FilesInterceptor("files", 3, uploadOptions(UploadFolder.MESSAGES, 3)),
  )
  async uploadMessageAttachments(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    return this.uploadsService.uploadMultipleFiles(
      files,
      UploadFolder.MESSAGES,
      req.user.id,
    );
  }

  @Post("presigned")
  async getPresignedUploadUrl(
    @Body() body: PresignedUploadDto,
    @Req() req: any,
  ) {
    return this.uploadsService.getPresignedUploadUrl(
      body.folder,
      req.user.id,
      body.filename,
      body.contentType,
    );
  }

  @Post("finalize")
  async finalizeUpload(@Body() body: FinalizeUploadDto, @Req() req: any) {
    return this.uploadsService.finalizeUpload(body.key, req.user.id);
  }

  @Get("read/:key")
  async readPrivateFile(
    @Param("key") key: string,
    @Req() req: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader("Cache-Control", "private, no-store");
    return this.uploadsService.getPrivateReadUrl(key, req.user);
  }

  @Delete(":key")
  async deleteFile(@Param("key") key: string, @Req() req: any) {
    // Decode the key (it might be URL encoded)
    const decodedKey = decodeURIComponent(key);
    await this.uploadsService.deleteFileForUser(decodedKey, req.user.id);
    return { success: true };
  }
}
