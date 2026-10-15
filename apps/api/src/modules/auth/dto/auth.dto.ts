import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsIn,
  Matches,
  MaxLength,
} from "class-validator";

export enum UserType {
  CUSTOMER = "customer",
  PROVIDER = "provider",
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsBoolean()
  gdprConsent: boolean;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsIn(["de", "en"])
  locale?: "de" | "en";
}

export class ResetPasswordDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
