import { Logger } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { QuotesService } from "../quotes/quotes.service";
import { RequestsService } from "../requests/requests.service";
import { BookingsService } from "../bookings/bookings.service";

describe("best-effort mutation notifications", () => {
  let db: any;
  let notifications: NotificationsService;
  let warn: jest.SpyInstance;
  const failure = new Error("private user id and request content");
  beforeEach(() => {
    db = {
      notification: { create: jest.fn().mockRejectedValue(failure) },
      provider: { findUnique: jest.fn().mockResolvedValue({ id: "p", userId: "provider", isApproved: true }) },
      user: { findUnique: jest.fn().mockResolvedValue({ userType: "admin" }) },
      quote: { create: jest.fn().mockResolvedValue({ id: "q" }), findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: "q" }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      serviceRequest: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: "r", status: "cancelled" }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      booking: { findUnique: jest.fn(), update: jest.fn() },
      conversation: { findFirst: jest.fn().mockRejectedValue(failure) },
      $transaction: jest.fn().mockImplementation(async (tasks) => Promise.all(tasks)),
    };
    notifications = new NotificationsService(db);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("returns the saved quote once when notification creation fails", async () => {
    db.serviceRequest.findUnique.mockResolvedValue({ id: "r", status: "open", customerId: "customer", title: "private title" });
    const service = new QuotesService(db, notifications);
    await expect(service.create("provider", { requestId: "r", price: 10, message: "offer", validUntil: "2099-01-01" })).resolves.toEqual({ id: "q" });
    expect(db.quote.create).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private|customer|provider/);
  });

  it.each(["lookup", "send"])("returns accepted quote after notification %s failure without repeating transaction", async (stage) => {
    const quote = { id: "q", customerId: "customer", providerId: "p", requestId: "r", status: "pending", validUntil: new Date("2099-01-01"), request: { status: "open", title: "title" } };
    db.quote.findUnique.mockResolvedValue(quote);
    const service = new QuotesService(db, notifications);
    jest.spyOn(service, "findOne").mockResolvedValue({ ...quote, status: "accepted" } as any);
    if (stage === "lookup") db.provider.findUnique.mockRejectedValue(failure);
    await expect(service.respond("q", "customer", "accepted")).resolves.toMatchObject({ status: "accepted" });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.quote.update).toHaveBeenCalledTimes(1);
  });

  it("tries all distinct request cancellation recipients despite one failure", async () => {
    db.serviceRequest.findUnique.mockResolvedValue({ id: "r", customerId: "customer", status: "open", title: "title", quotes: [{ provider: { userId: "one" } }, { provider: { userId: "two" } }, { provider: { userId: "one" } }] });
    db.notification.create.mockRejectedValueOnce(failure).mockResolvedValue({ id: "n" });
    await expect(new RequestsService(db, notifications).cancel("r", "customer")).resolves.toMatchObject({ status: "cancelled" });
    expect(db.notification.create.mock.calls.map(([arg]: any[]) => arg.data.userId)).toEqual(["customer", "one", "two"]);
    expect(db.serviceRequest.update).toHaveBeenCalledTimes(1);
  });

  it.each(["completion_pending", "completed", "cancelled"])("returns saved booking %s and attempts each notification", async (status) => {
    db.booking.findUnique.mockResolvedValue({ id: "b", quoteId: "q", customerId: "customer", status: status === "completed" ? "completion_pending" : "confirmed", provider: { userId: "provider" }, quote: { requestId: "r" } });
    const saved = { id: "b", customerId: "customer", status, quote: { requestId: "r", request: { id: "r", title: "title" } }, customer: { id: "customer" }, provider: { userId: "provider", user: { id: "provider" } } };
    db.booking.update.mockResolvedValue(saved);
    await expect(new BookingsService(db, notifications).updateStatus("b", status === "completion_pending" ? "provider" : "customer", status)).resolves.toEqual(saved);
    expect(db.booking.update).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledTimes(status === "completion_pending" ? 1 : 2);
  });

  it("propagates a quote create failure without attempting notification", async () => {
    db.serviceRequest.findUnique.mockResolvedValue({ id: "r", status: "open" });
    db.quote.create.mockRejectedValue(failure);
    await expect(new QuotesService(db, notifications).create("provider", { requestId: "r", price: 10, message: "offer", validUntil: "2099-01-01" })).rejects.toBe(failure);
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it("propagates the main booking transaction failure", async () => {
    db.booking.findUnique.mockResolvedValue({ id: "b", quoteId: "q", customerId: "customer", status: "confirmed", provider: { userId: "provider" }, quote: { requestId: "r" } });
    db.$transaction.mockRejectedValue(failure);
    await expect(new BookingsService(db, notifications).updateStatus("b", "customer", "cancelled")).rejects.toBe(failure);
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
