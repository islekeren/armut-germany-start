import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
} from "class-validator";

export enum QuoteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

enum QuoteResponseAction {
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export class CreateQuoteDto {
  @IsString()
  requestId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  message: string;

  @IsDateString()
  validUntil: string;
}

export class UpdateQuoteDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class RespondToQuoteDto {
  @IsEnum(QuoteResponseAction)
  action: "accepted" | "rejected";
}
