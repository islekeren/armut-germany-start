import { QuotesController } from "./quotes.controller";

describe("QuotesController", () => {
  const quotesService = {
    create: jest.fn(),
    findByProvider: jest.fn(),
    findByCustomer: jest.fn(),
    findByRequest: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    respond: jest.fn(),
    withdraw: jest.fn(),
  };

  let controller: QuotesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new QuotesController(quotesService as any);
  });

  it("creates quote", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { requestId: "r1", price: 120 };
    quotesService.create.mockResolvedValue({ id: "q1" });
    await expect(controller.create(req, dto)).resolves.toEqual({ id: "q1" });
    expect(quotesService.create).toHaveBeenCalledWith("u1", dto);
  });

  it("gets provider quotes", async () => {
    const req = { user: { id: "u1" } };
    quotesService.findByProvider.mockResolvedValue([]);
    await expect(controller.getMyQuotes(req)).resolves.toEqual([]);
    expect(quotesService.findByProvider).toHaveBeenCalledWith("u1");
  });

  it("gets customer received quotes", async () => {
    const req = { user: { id: "u1" } };
    quotesService.findByCustomer.mockResolvedValue([]);
    await expect(controller.getReceivedQuotes(req)).resolves.toEqual([]);
    expect(quotesService.findByCustomer).toHaveBeenCalledWith("u1");
  });

  it("gets quotes by request", async () => {
    const req = { user: { id: "u1" } };
    quotesService.findByRequest.mockResolvedValue([]);
    await expect(controller.getByRequest("r1", req)).resolves.toEqual([]);
    expect(quotesService.findByRequest).toHaveBeenCalledWith("r1", "u1");
  });

  it("gets quote by id", async () => {
    const req = { user: { id: "u1" } };
    quotesService.findOne.mockResolvedValue({ id: "q1" });
    await expect(controller.findOne("q1", req)).resolves.toEqual({ id: "q1" });
    expect(quotesService.findOne).toHaveBeenCalledWith("q1", "u1");
  });

  it("updates quote", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { price: 150 };
    quotesService.update.mockResolvedValue({ id: "q1", ...dto });
    await expect(controller.update("q1", req, dto)).resolves.toEqual({
      id: "q1",
      ...dto,
    });
    expect(quotesService.update).toHaveBeenCalledWith("q1", "u1", dto);
  });

  it("responds to quote", async () => {
    const req = { user: { id: "u1" } };
    quotesService.respond.mockResolvedValue({ id: "q1", status: "accepted" });
    await expect(
      controller.respond("q1", req, { action: "accepted" } as any)
    ).resolves.toEqual({
      id: "q1",
      status: "accepted",
    });
    expect(quotesService.respond).toHaveBeenCalledWith("q1", "u1", "accepted");
  });

  it("withdraws quote", async () => {
    const req = { user: { id: "u1" } };
    quotesService.withdraw.mockResolvedValue({ id: "q1" });
    await expect(controller.withdraw("q1", req)).resolves.toEqual({ id: "q1" });
    expect(quotesService.withdraw).toHaveBeenCalledWith("q1", "u1");
  });
});
