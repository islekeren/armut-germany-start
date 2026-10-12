import { IsUUID } from "class-validator";

export class CreateCheckoutSessionDto {
  @IsUUID()
  bookingId: string;
}

export class RefundPaymentDto {
  @IsUUID()
  bookingId: string;
}
