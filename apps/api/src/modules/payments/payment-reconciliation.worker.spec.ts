import { ConfigService } from "@nestjs/config";
import { PaymentReconciliationWorker } from "./payment-reconciliation.worker";

describe("payment worker lifecycle", () => {
  afterEach(() => jest.useRealTimers());
  it("does not run external work while payments are disabled", async () => {
    jest.useFakeTimers();
    const operations = { drain: jest.fn() };
    const worker = new PaymentReconciliationWorker(
      new ConfigService({ PAYMENTS_MODE: "disabled" }),
      {} as any,
      operations as any,
      {} as any,
      {} as any,
    );
    worker.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    expect(operations.drain).not.toHaveBeenCalled();
    worker.onModuleDestroy();
  });
  it("recovers pending attempts and operations without overlapping ticks", async () => {
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const payments = { reconcilePendingWebhooks: jest.fn(() => waiting) };
    const attempts = { createReserved: jest.fn() };
    const operations = { drain: jest.fn() };
    const db = {
      paymentAttempt: { findMany: jest.fn(async () => [{ id: "reserved" }]) },
    };
    const worker = new PaymentReconciliationWorker(
      new ConfigService({ PAYMENTS_MODE: "sandbox" }),
      db as any,
      operations as any,
      attempts as any,
      payments as any,
    );
    const first = worker.tick();
    await worker.tick();
    expect(payments.reconcilePendingWebhooks).toHaveBeenCalledTimes(1);
    finish();
    await first;
    expect(attempts.createReserved).toHaveBeenCalledWith("reserved");
    expect(operations.drain).toHaveBeenCalledTimes(1);
  });
});
