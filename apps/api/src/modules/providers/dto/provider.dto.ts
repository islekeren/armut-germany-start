import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsBoolean,
} from "class-validator";

export class CreateProviderDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceYears?: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  serviceAreaRadius: number;

  @IsNumber()
  serviceAreaLat: number;

  @IsNumber()
  serviceAreaLng: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  serviceAreaRadius?: number;

  @IsOptional()
  @IsNumber()
  serviceAreaLat?: number;

  @IsOptional()
  @IsNumber()
  serviceAreaLng?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];
}

export class ApproveProviderDto {
  @IsBoolean()
  isApproved: boolean;
}

export class ProviderQueryDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  radius?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
