import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripeConnectController } from "./stripe-connect.controller";
import { StripeConnectService } from "./stripe-connect.service";
import { StripeService } from "./stripe.service";

import { PaymentAttemptsService } from "./payment-attempts.service";
import { PaymentCoordinationService } from "./payment-coordination.service";

import { PaymentOperationsService } from "./payment-operations.service";
import { PaymentReconciliationWorker } from "./payment-reconciliation.worker";

@Module({
  controllers: [PaymentsController, StripeConnectController],
  providers: [
    PaymentOperationsService,
    PaymentReconciliationWorker,
    PaymentAttemptsService,
    PaymentCoordinationService,
    PaymentsService,
    StripeConnectService,
    StripeService,
  ],
  exports: [PaymentsService, StripeConnectService, StripeService],
})
export class PaymentsModule {}
