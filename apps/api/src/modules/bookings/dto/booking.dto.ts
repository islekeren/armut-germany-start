import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
} from "class-validator";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  IN_PROGRESS = "in_progress",
  COMPLETION_PENDING = "completion_pending",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export class CreateBookingDto {
  @IsString()
  quoteId: string;

  @IsDateString()
  scheduledDate: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

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

export class BookingQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
