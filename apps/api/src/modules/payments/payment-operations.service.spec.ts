import { PaymentOperationsService } from "./payment-operations.service";

describe("durable operation recovery", () => {
  let operation: any;
  let payment: any;
  let rejectWrite: boolean;
  const stripe = {
    assertEnabled: jest.fn(),
    assertEventMode: jest.fn(),
    getPaymentsMode: () => "sandbox",
    createTransfer: jest.fn(),
    reverseTransfer: jest.fn(),
    createRefund: jest.fn(),
  };
  const db: any = {
    paymentOperation: {
      updateMany: jest.fn(async ({ where, data }) => {
        if (where.status && operation.status !== where.status)
          return { count: 0 };
        Object.assign(operation, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async () => ({ ...operation })),
      update: jest.fn(async ({ data }) => {
        if (rejectWrite && data.status === "succeeded") {
          rejectWrite = false;
          throw new Error("DB unavailable");
        }
        Object.assign(operation, data);
        return { ...operation };
      }),
      upsert: jest.fn(async () => operation),
      findUnique: jest.fn(async () => null),
    },
    payment: {
      findUniqueOrThrow: jest.fn(async () => ({ ...payment })),
      update: jest.fn(async ({ data }) => Object.assign(payment, data)),
    },
    paymentDispute: { count: jest.fn(async () => 0) },
  };
  const coordination = { withPayment: async (_id: string, fn: any) => fn(db) };
  let service: PaymentOperationsService;
  beforeEach(() => {
    jest.clearAllMocks();
    rejectWrite = false;
    operation = {
      id: "op",
      paymentId: "pay",
      kind: "transfer",
      status: "pending",
      payload: {
        amount: 8500,
        currency: "eur",
        destination: "acct",
        source_transaction: "ch",
      },
      idempotencyKey: "provider-transfer:pay",
      firstCalledAt: null,
      externalId: null,
    };
    payment = {
      id: "pay",
      status: "paid",
      disputedAt: null,
      refundRequestedAt: null,
      reconciliationReason: null,
      stripeTransferId: null,
    };
    stripe.createTransfer.mockResolvedValue({ id: "tr" });
    stripe.reverseTransfer.mockResolvedValue({ id: "rev" });
    service = new PaymentOperationsService(
      db,
      coordination as any,
      stripe as any,
      {
        ensureEligible: jest
          .fn()
          .mockResolvedValue({ stripeAccountId: "acct" }),
      } as any,
    );
  });
  it("holds transfer before an already recorded dispute", async () => {
    payment.disputedAt = new Date();
    await service.runOperation("op");
    expect(stripe.createTransfer).not.toHaveBeenCalled();
    expect(operation.status).toBe("pending");
  });
  it("stores transfer and schedules reversal for a dispute during the call", async () => {
    stripe.createTransfer.mockImplementation(async () => {
      payment.disputedAt = new Date();
      return { id: "tr" };
    });
    await service.runOperation("op");
    expect(payment.stripeTransferId).toBe("tr");
    expect(db.paymentOperation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ kind: "reversal" }),
      }),
    );
  });
  it("recovers Stripe success after DB failure using exactly the same key", async () => {
    rejectWrite = true;
    await expect(service.runOperation("op")).rejects.toThrow("DB unavailable");
    operation.status = "pending";
    operation.leaseUntil = null;
    await service.runOperation("op");
    expect(stripe.createTransfer).toHaveBeenCalledTimes(2);
    expect(stripe.createTransfer.mock.calls[0]).toEqual(
      stripe.createTransfer.mock.calls[1],
    );
    expect(operation.status).toBe("succeeded");
  });
  it("does not blindly recreate an operation after idempotency retention", async () => {
    operation.firstCalledAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await service.runOperation("op");
    expect(stripe.createTransfer).not.toHaveBeenCalled();
    expect(operation.status).toBe("reconciliation_required");
  });
});
