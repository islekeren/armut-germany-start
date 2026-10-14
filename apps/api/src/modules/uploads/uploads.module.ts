import { Module } from "@nestjs/common";
import { UploadRequestBudget } from "./upload-multipart";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, UploadRequestBudget],
  exports: [UploadsService],
})
export class UploadsModule {}
