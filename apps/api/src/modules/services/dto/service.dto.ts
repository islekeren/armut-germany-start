import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { PartialType } from "@nestjs/swagger";
import { PriceType } from "@prisma/client";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateServiceDto {
  @IsUUID()
  categoryId: string;

  @Transform(trim)
  @IsString()
  @Matches(/\S/, { message: "title must contain text" })
  @MaxLength(200)
  title: string;

  @Transform(trim)
  @IsString()
  @Matches(/\S/, { message: "description must contain text" })
  @MaxLength(5000)
  description: string;

  @IsIn(["fixed", "hourly", "quote"])
  priceType: PriceType;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  priceMin?: number | null;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  priceMax?: number | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto, {
  skipNullProperties: false,
}) {}
