import { Type } from "class-transformer";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from "class-validator";

export class CreateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class ProviderReplyDto {
  @IsString()
  reply: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  replyImages?: string[];
}

export class ReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class ReplyToReviewDto {
  @IsString()
  reply: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  replyImages?: string[];
}
