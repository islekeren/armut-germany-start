import { IsNotEmpty, IsString, MaxLength } from "class-validator";
export class FinalizeUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  key: string;
}
