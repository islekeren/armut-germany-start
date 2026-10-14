import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { UploadFolder } from "../uploads.service";

export class PresignedUploadDto {
  @IsEnum(UploadFolder)
  folder: UploadFolder;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsString()
  contentType: string;
}
