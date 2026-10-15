import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token: string;

  @IsIn(["ios", "android"])
  platform: "ios" | "android";
}

export class UnregisterPushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token: string;
}
