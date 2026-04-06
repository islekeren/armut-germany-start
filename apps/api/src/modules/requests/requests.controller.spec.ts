import { RequestsController } from "./requests.controller";
import { ForbiddenException } from "@nestjs/common";

describe("RequestsController", () => {
  const requestsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByCustomer: jest.fn(),
    getForProvider: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  };

  let controller: RequestsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RequestsController(requestsService as any);
  });

  it("creates request for authenticated user", async () => {
    const req = { user: { id: "u1", userType: "customer" } };
    const dto: any = { title: "Need cleaning" };
    requestsService.create.mockResolvedValue({ id: "r1" });
    await expect(controller.create(req, dto)).resolves.toEqual({ id: "r1" });
    expect(requestsService.create).toHaveBeenCalledWith("u1", dto, "customer");
  });

  it("rejects non-customer users from creating requests", async () => {
    const req = { user: { id: "u1", userType: "provider" } };
    const dto: any = { title: "Need cleaning" };

    expect(() => controller.create(req, dto)).toThrow(ForbiddenException);
    expect(requestsService.create).not.toHaveBeenCalled();
  });

  it("returns all requests", async () => {
    const query: any = { categorySlug: "home-cleaning", postalCode: "10115", page: 2 };
    requestsService.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query)).resolves.toEqual({ data: [] });
    expect(requestsService.findAll).toHaveBeenCalledWith(query);
  });

  it("returns authenticated user's requests", async () => {
    const req = { user: { id: "u1" } };
    requestsService.findByCustomer.mockResolvedValue([]);
    await expect(controller.getMyRequests(req, "open")).resolves.toEqual([]);
    expect(requestsService.findByCustomer).toHaveBeenCalledWith("u1", "open");
  });

  it("returns requests for provider", async () => {
    const query: any = { limit: 5 };
    requestsService.getForProvider.mockResolvedValue({ data: [] });
    await expect(controller.getForProvider("p1", query)).resolves.toEqual({
      data: [],
    });
    expect(requestsService.getForProvider).toHaveBeenCalledWith("p1", query);
  });

  it("returns request by id", async () => {
    requestsService.findOne.mockResolvedValue({ id: "r1" });
    await expect(controller.findOne("r1")).resolves.toEqual({ id: "r1" });
    expect(requestsService.findOne).toHaveBeenCalledWith("r1");
  });

  it("updates request by id", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { title: "Updated" };
    requestsService.update.mockResolvedValue({ id: "r1", title: "Updated" });
    await expect(controller.update("r1", req, dto)).resolves.toEqual({
      id: "r1",
      title: "Updated",
    });
    expect(requestsService.update).toHaveBeenCalledWith("r1", "u1", dto);
  });

  it("cancels request by id", async () => {
    const req = { user: { id: "u1" } };
    requestsService.cancel.mockResolvedValue({ id: "r1", status: "cancelled" });
    await expect(controller.cancel("r1", req)).resolves.toEqual({
      id: "r1",
      status: "cancelled",
    });
    expect(requestsService.cancel).toHaveBeenCalledWith("r1", "u1");
  });
});
