import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ProvidersController } from "./providers.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";

describe("ProvidersController", () => {
  const providersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByUserId: jest.fn(),
    updateMyProfile: jest.fn(),
    getPublicProfile: jest.fn(),
    getStats: jest.fn(),
    getDashboard: jest.fn(),
    getRequests: jest.fn(),
    getBookings: jest.fn(),
    getReviews: jest.fn(),
    replyToReview: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    approve: jest.fn(),
  };

  let controller: ProvidersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProvidersController(providersService as any);
  });

  it("creates provider profile", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { companyName: "Company" };
    providersService.create.mockResolvedValue({ id: "p1" });
    await expect(controller.create(req, dto)).resolves.toEqual({ id: "p1" });
    expect(providersService.create).toHaveBeenCalledWith("u1", dto);
  });

  it("lists providers", async () => {
    const query: any = { page: 1 };
    providersService.findAll.mockResolvedValue({ data: [] });
    await expect(controller.findAll(query)).resolves.toEqual({ data: [] });
    expect(providersService.findAll).toHaveBeenCalledWith(query);
  });

  it("gets own profile", async () => {
    const req = { user: { id: "u1" } };
    providersService.findByUserId.mockResolvedValue({ id: "p1" });
    await expect(controller.getMyProfile(req)).resolves.toEqual({ id: "p1" });
    expect(providersService.findByUserId).toHaveBeenCalledWith("u1");
  });

  it("gets own stats", async () => {
    const req = { user: { id: "u1" } };
    providersService.getStats.mockResolvedValue({ rating: 5 });
    await expect(controller.getMyStats(req)).resolves.toEqual({ rating: 5 });
    expect(providersService.getStats).toHaveBeenCalledWith("u1");
  });

  it("gets own dashboard", async () => {
    const req = { user: { id: "u1" } };
    providersService.getDashboard.mockResolvedValue({ summary: true });
    await expect(controller.getMyDashboard(req)).resolves.toEqual({
      summary: true,
    });
    expect(providersService.getDashboard).toHaveBeenCalledWith("u1");
  });

  it("gets own requests", async () => {
    const req = { user: { id: "u1" } };
    const query: any = { page: 2 };
    providersService.getRequests.mockResolvedValue({ data: [] });
    await expect(controller.getMyRequests(req, query)).resolves.toEqual({
      data: [],
    });
    expect(providersService.getRequests).toHaveBeenCalledWith("u1", query);
  });

  it("gets own bookings", async () => {
    const req = { user: { id: "u1" } };
    const query: any = { page: 1 };
    providersService.getBookings.mockResolvedValue({ data: [] });
    await expect(controller.getMyBookings(req, query)).resolves.toEqual({
      data: [],
    });
    expect(providersService.getBookings).toHaveBeenCalledWith("u1", query);
  });

  it("gets own reviews", async () => {
    const req = { user: { id: "u1" } };
    const query: any = { limit: 10 };
    providersService.getReviews.mockResolvedValue({ data: [] });
    await expect(controller.getMyReviews(req, query)).resolves.toEqual({
      data: [],
    });
    expect(providersService.getReviews).toHaveBeenCalledWith("u1", query);
  });

  it("replies to review", async () => {
    const req = { user: { id: "u1" } };
    providersService.replyToReview.mockResolvedValue({ success: true });
    await expect(
      controller.replyToReview(req, "rev1", { reply: "Thanks!" } as any),
    ).resolves.toEqual({ success: true });
    expect(providersService.replyToReview).toHaveBeenCalledWith(
      "u1",
      "rev1",
      "Thanks!",
      undefined,
    );
  });

  it("gets provider by id", async () => {
    providersService.findOne.mockResolvedValue({ id: "p1" });
    await expect(controller.findOne("p1")).resolves.toEqual({ id: "p1" });
    expect(providersService.findOne).toHaveBeenCalledWith("p1");
  });

  it("gets public provider profile", async () => {
    providersService.getPublicProfile.mockResolvedValue({
      id: "p1",
      profile: {},
    });
    await expect(controller.getPublicProfile("p1")).resolves.toEqual({
      id: "p1",
      profile: {},
    });
    expect(providersService.getPublicProfile).toHaveBeenCalledWith("p1");
  });

  it("updates provider by id", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { description: "Updated" };
    providersService.update.mockResolvedValue({ id: "p1", ...dto });
    await expect(controller.update("p1", req, dto)).resolves.toEqual({
      id: "p1",
      ...dto,
    });
    expect(providersService.update).toHaveBeenCalledWith("p1", "u1", dto);
  });

  it("updates own provider profile", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { headline: "Top rated" };
    providersService.updateMyProfile.mockResolvedValue({
      id: "p1",
      profile: dto,
    });

    await expect(controller.updateMyProfile(req, dto)).resolves.toEqual({
      id: "p1",
      profile: dto,
    });
    expect(providersService.updateMyProfile).toHaveBeenCalledWith("u1", dto);
  });

  it("approves provider", async () => {
    providersService.approve.mockResolvedValue({ id: "p1", isApproved: true });
    await expect(
      controller.approve("p1", { isApproved: true } as any),
    ).resolves.toEqual({
      id: "p1",
      isApproved: true,
    });
    expect(providersService.approve).toHaveBeenCalledWith("p1", true);
  });

  it("protects approval with jwt and admin guards", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ProvidersController.prototype.approve,
    );

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, AdminGuard]));
  });
});
