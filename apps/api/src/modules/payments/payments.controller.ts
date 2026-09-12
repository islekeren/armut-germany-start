import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateCheckoutSessionDto } from "./dto/payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("checkout-session")
  @UseGuards(JwtAuthGuard)
  createCheckoutSession(
    @Req() req: any,
    @Body() body: CreateCheckoutSessionDto,
  ) {
    return this.paymentsService.createCheckoutSession(
      req.user.id,
      body.bookingId,
    );
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    const event = this.paymentsService.constructWebhookEvent(
      req.rawBody!,
      signature ?? "",
    );
    return this.paymentsService.processWebhook(event);
  }
}
