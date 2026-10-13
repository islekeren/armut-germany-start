import { Module } from "@nestjs/common";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { NotificationsModule } from "../notifications/notifications.module";

import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [NotificationsModule, PaymentsModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
