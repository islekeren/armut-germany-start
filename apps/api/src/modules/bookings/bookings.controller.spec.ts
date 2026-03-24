import { BookingsController } from "./bookings.controller";

describe("BookingsController", () => {
  const bookingsService = {
    create: jest.fn(),
    findByCustomer: jest.fn(),
    findByProvider: jest.fn(),
    getUpcoming: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    reschedule: jest.fn(),
    createReview: jest.fn(),
    addProviderReply: jest.fn(),
  };

  let controller: BookingsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BookingsController(bookingsService as any);
  });

  it("creates booking", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { quoteId: "q1", scheduledDate: new Date().toISOString() };
    bookingsService.create.mockResolvedValue({ id: "b1" });
    await expect(controller.create(req, dto)).resolves.toEqual({ id: "b1" });
    expect(bookingsService.create).toHaveBeenCalledWith("u1", dto);
  });

  it("gets customer bookings", async () => {
    const req = { user: { id: "u1" } };
    const query: any = { page: 1 };
    bookingsService.findByCustomer.mockResolvedValue({ data: [] });
    await expect(controller.getCustomerBookings(req, query)).resolves.toEqual({
      data: [],
    });
    expect(bookingsService.findByCustomer).toHaveBeenCalledWith("u1", query);
  });

  it("gets provider bookings", async () => {
    const req = { user: { id: "u1" } };
    const query: any = { status: "pending" };
    bookingsService.findByProvider.mockResolvedValue({ data: [] });
    await expect(controller.getProviderBookings(req, query)).resolves.toEqual({
      data: [],
    });
    expect(bookingsService.findByProvider).toHaveBeenCalledWith("u1", query);
  });

  it("gets upcoming customer bookings", async () => {
    const req = { user: { id: "u1" } };
    bookingsService.getUpcoming.mockResolvedValue([]);
    await expect(controller.getUpcomingCustomer(req)).resolves.toEqual([]);
    expect(bookingsService.getUpcoming).toHaveBeenCalledWith("u1", "customer");
  });

  it("gets upcoming provider bookings", async () => {
    const req = { user: { id: "u1" } };
    bookingsService.getUpcoming.mockResolvedValue([]);
    await expect(controller.getUpcomingProvider(req)).resolves.toEqual([]);
    expect(bookingsService.getUpcoming).toHaveBeenCalledWith("u1", "provider");
  });

  it("gets booking by id for authenticated requester", async () => {
    const req = { user: { id: "u1", userType: "customer" } };
    bookingsService.findOne.mockResolvedValue({ id: "b1" });
    await expect(controller.findOne("b1", req)).resolves.toEqual({ id: "b1" });
    expect(bookingsService.findOne).toHaveBeenCalledWith("b1", req.user);
  });

  it("updates booking status", async () => {
    const req = { user: { id: "u1" } };
    bookingsService.updateStatus.mockResolvedValue({ id: "b1", status: "confirmed" });
    await expect(
      controller.updateStatus("b1", req, { status: "confirmed" } as any)
    ).resolves.toEqual({
      id: "b1",
      status: "confirmed",
    });
    expect(bookingsService.updateStatus).toHaveBeenCalledWith(
      "b1",
      "u1",
      "confirmed"
    );
  });

  it("reschedules booking", async () => {
    const req = { user: { id: "u1" } };
    bookingsService.reschedule.mockResolvedValue({ id: "b1" });
    await expect(
      controller.reschedule("b1", req, "2026-02-24T12:00:00.000Z")
    ).resolves.toEqual({ id: "b1" });
    expect(bookingsService.reschedule).toHaveBeenCalledWith(
      "b1",
      "u1",
      "2026-02-24T12:00:00.000Z"
    );
  });

  it("creates booking review", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { rating: 5, comment: "Great" };
    bookingsService.createReview.mockResolvedValue({ id: "rev1" });
    await expect(controller.createReview("b1", req, dto)).resolves.toEqual({
      id: "rev1",
    });
    expect(bookingsService.createReview).toHaveBeenCalledWith("b1", "u1", dto);
  });

  it("adds provider reply", async () => {
    const req = { user: { id: "u1" } };
    bookingsService.addProviderReply.mockResolvedValue({ id: "rev1" });
    await expect(
      controller.addProviderReply("b1", req, { reply: "Thanks" } as any)
    ).resolves.toEqual({ id: "rev1" });
    expect(bookingsService.addProviderReply).toHaveBeenCalledWith(
      "b1",
      "u1",
      "Thanks"
    );
  });
});
