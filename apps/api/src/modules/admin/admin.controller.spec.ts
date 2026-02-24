import { AdminController } from "./admin.controller";

describe("AdminController", () => {
  const adminService = {
    getDashboardStats: jest.fn(),
    getUsers: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getProviders: jest.fn(),
    getPendingProviders: jest.fn(),
    approveProvider: jest.fn(),
    getCategories: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    getRevenueReport: jest.fn(),
    getCategoryReport: jest.fn(),
    getTopProviders: jest.fn(),
  };

  let controller: AdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminController(adminService as any);
  });

  it("gets dashboard stats", async () => {
    adminService.getDashboardStats.mockResolvedValue({ users: { total: 1 } });
    await expect(controller.getDashboardStats()).resolves.toEqual({
      users: { total: 1 },
    });
  });

  it("gets users with query", async () => {
    adminService.getUsers.mockResolvedValue({ data: [] });
    await expect(controller.getUsers(2, 10, "customer", "max")).resolves.toEqual({
      data: [],
    });
    expect(adminService.getUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      userType: "customer",
      search: "max",
    });
  });

  it("gets user by id", async () => {
    adminService.getUser.mockResolvedValue({ id: "u1" });
    await expect(controller.getUser("u1")).resolves.toEqual({ id: "u1" });
    expect(adminService.getUser).toHaveBeenCalledWith("u1");
  });

  it("updates user by id", async () => {
    adminService.updateUser.mockResolvedValue({ id: "u1", isVerified: true });
    await expect(controller.updateUser("u1", { isVerified: true })).resolves.toEqual(
      {
        id: "u1",
        isVerified: true,
      }
    );
    expect(adminService.updateUser).toHaveBeenCalledWith("u1", {
      isVerified: true,
    });
  });

  it("deletes user by id", async () => {
    adminService.deleteUser.mockResolvedValue({ id: "u1" });
    await expect(controller.deleteUser("u1")).resolves.toEqual({ id: "u1" });
    expect(adminService.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("gets providers and parses isApproved=true", async () => {
    adminService.getProviders.mockResolvedValue({ data: [] });
    await controller.getProviders(1, 20, "true", "acme");
    expect(adminService.getProviders).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      isApproved: true,
      search: "acme",
    });
  });

  it("gets providers and parses isApproved=false", async () => {
    adminService.getProviders.mockResolvedValue({ data: [] });
    await controller.getProviders(1, 20, "false", "acme");
    expect(adminService.getProviders).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      isApproved: false,
      search: "acme",
    });
  });

  it("gets providers and parses unknown isApproved to undefined", async () => {
    adminService.getProviders.mockResolvedValue({ data: [] });
    await controller.getProviders(1, 20, "all", "acme");
    expect(adminService.getProviders).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      isApproved: undefined,
      search: "acme",
    });
  });

  it("gets pending providers", async () => {
    adminService.getPendingProviders.mockResolvedValue({ data: [] });
    await expect(controller.getPendingProviders(1, 20)).resolves.toEqual({
      data: [],
    });
    expect(adminService.getPendingProviders).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it("approves provider", async () => {
    adminService.approveProvider.mockResolvedValue({ id: "p1", isApproved: true });
    await expect(
      controller.approveProvider("p1", { approved: true })
    ).resolves.toEqual({
      id: "p1",
      isApproved: true,
    });
    expect(adminService.approveProvider).toHaveBeenCalledWith("p1", true);
  });

  it("gets categories", async () => {
    adminService.getCategories.mockResolvedValue([{ id: "c1" }]);
    await expect(controller.getCategories()).resolves.toEqual([{ id: "c1" }]);
  });

  it("creates category", async () => {
    const dto = {
      slug: "cleaning",
      nameDe: "Reinigung",
      nameEn: "Cleaning",
      icon: "broom",
    };
    adminService.createCategory.mockResolvedValue({ id: "c1", ...dto });
    await expect(controller.createCategory(dto)).resolves.toEqual({
      id: "c1",
      ...dto,
    });
    expect(adminService.createCategory).toHaveBeenCalledWith(dto);
  });

  it("updates category", async () => {
    adminService.updateCategory.mockResolvedValue({ id: "c1", nameEn: "Updated" });
    await expect(controller.updateCategory("c1", { nameEn: "Updated" })).resolves.toEqual(
      {
        id: "c1",
        nameEn: "Updated",
      }
    );
    expect(adminService.updateCategory).toHaveBeenCalledWith("c1", {
      nameEn: "Updated",
    });
  });

  it("deletes category", async () => {
    adminService.deleteCategory.mockResolvedValue({ id: "c1" });
    await expect(controller.deleteCategory("c1")).resolves.toEqual({ id: "c1" });
    expect(adminService.deleteCategory).toHaveBeenCalledWith("c1");
  });

  it("gets revenue report with parsed date args", async () => {
    adminService.getRevenueReport.mockResolvedValue({ totalRevenue: 100 });
    await expect(
      controller.getRevenueReport("2026-01-01", "2026-01-31")
    ).resolves.toEqual({ totalRevenue: 100 });
    expect(adminService.getRevenueReport).toHaveBeenCalledWith(
      new Date("2026-01-01"),
      new Date("2026-01-31")
    );
  });

  it("gets category report", async () => {
    adminService.getCategoryReport.mockResolvedValue([]);
    await expect(controller.getCategoryReport()).resolves.toEqual([]);
  });

  it("gets top providers", async () => {
    adminService.getTopProviders.mockResolvedValue([]);
    await expect(controller.getTopProviders(5)).resolves.toEqual([]);
    expect(adminService.getTopProviders).toHaveBeenCalledWith(5);
  });
});
