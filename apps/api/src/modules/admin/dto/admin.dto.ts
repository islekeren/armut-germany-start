import { IsBoolean, IsOptional, IsString } from "class-validator";

// Bodies were previously typed inline, which the global ValidationPipe cannot
// see; these classes let it whitelist and validate them.

export class AdminUpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export class AdminApproveProviderDto {
  @IsBoolean()
  approved: boolean;
}

export class AdminCreateCategoryDto {
  @IsString()
  slug: string;

  @IsString()
  nameDe: string;

  @IsString()
  nameEn: string;

  @IsString()
  icon: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class AdminUpdateCategoryDto {
  @IsOptional()
  @IsString()
  nameDe?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
