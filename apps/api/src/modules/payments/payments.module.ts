import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripeConnectController } from "./stripe-connect.controller";
import { StripeConnectService } from "./stripe-connect.service";
import { StripeService } from "./stripe.service";

@Module({
  controllers: [PaymentsController, StripeConnectController],
  providers: [PaymentsService, StripeConnectService, StripeService],
  exports: [PaymentsService, StripeConnectService, StripeService],
})
export class PaymentsModule {}
