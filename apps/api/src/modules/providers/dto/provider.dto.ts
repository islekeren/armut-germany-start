import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
  IsUrl,
  IsIn,
  ValidateIf,
} from "class-validator";

const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export class ProviderOpeningHourDto {
  @IsString()
  @IsIn(WEEK_DAYS)
  day: string;

  @IsBoolean()
  closed: boolean;

  @IsOptional()
  @ValidateIf((obj: ProviderOpeningHourDto) => !obj.closed)
  @IsString()
  open?: string;

  @IsOptional()
  @ValidateIf((obj: ProviderOpeningHourDto) => !obj.closed)
  @IsString()
  close?: string;
}

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
  categories?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: "website must be a valid URL" })
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderOpeningHourDto)
  openingHours?: ProviderOpeningHourDto[];
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

export class UpdateOwnProviderProfileDto extends UpdateProviderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: "website must be a valid URL" })
  website?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsBoolean()
  phoneVisible?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderOpeningHourDto)
  openingHours?: ProviderOpeningHourDto[];
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

export class ProviderRequestsQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class ProviderBookingsQueryDto {
  @IsOptional()
  @IsNumber()
  month?: number;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ProviderReviewsQueryDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class ReplyToReviewDto {
  @IsString()
  reply: string;
}
