import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { UploadFolder } from "../uploads.service";

export class PresignedUploadDto {
  @IsEnum(UploadFolder)
  folder: UploadFolder;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  contentType: string;
}
