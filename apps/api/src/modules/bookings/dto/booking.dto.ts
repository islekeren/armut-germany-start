import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
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

export class RescheduleBookingDto {
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

export class BookingQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
