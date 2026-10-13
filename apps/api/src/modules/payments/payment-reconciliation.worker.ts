import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentOperationsService } from "./payment-operations.service";
import { PaymentAttemptsService } from "./payment-attempts.service";
import { PaymentsService } from "./payments.service";

@Injectable()
export class PaymentReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly operations: PaymentOperationsService,
    private readonly attempts: PaymentAttemptsService,
    private readonly payments: PaymentsService,
  ) {}
  onModuleInit() {
    if (
      (this.config.get("PAYMENTS_MODE") ?? "disabled") === "disabled" ||
      this.config.get("PAYMENT_WORKER_DISABLED") === "true"
    )
      return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.payments.reconcilePendingWebhooks();
      const pending = await this.prisma.paymentAttempt.findMany({
        where: {
          status: "creating",
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        take: 10,
      });
      for (const attempt of pending) {
        try {
          await this.attempts.createReserved(attempt.id);
        } catch {
          /* original key is retried next tick */
        }
      }
      await this.operations.drain();
    } catch {
      this.logger.error(
        "Payment reconciliation tick failed; durable work will be retried",
      );
    } finally {
      this.running = false;
    }
  }
}
