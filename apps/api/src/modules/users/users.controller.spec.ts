import { ForbiddenException } from "@nestjs/common";
import { UsersController } from "./users.controller";

describe("UsersController", () => {
  const usersService = {
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UsersController(usersService as any);
  });

  it("gets profile from authenticated user", async () => {
    const req = { user: { id: "u1" } };
    usersService.findById.mockResolvedValue({ id: "u1" });
    await expect(controller.getProfile(req)).resolves.toEqual({ id: "u1" });
    expect(usersService.findById).toHaveBeenCalledWith("u1");
  });

  it("updates profile from authenticated user", async () => {
    const req = { user: { id: "u1" } };
    const dto = { firstName: "Updated" } as any;
    usersService.update.mockResolvedValue({ id: "u1", ...dto });
    await expect(controller.updateProfile(req, dto)).resolves.toEqual({
      id: "u1",
      ...dto,
    });
    expect(usersService.update).toHaveBeenCalledWith("u1", dto);
  });

  it("deletes profile from authenticated user", async () => {
    const req = { user: { id: "u1" } };
    usersService.delete.mockResolvedValue({ id: "u1" });
    await expect(controller.deleteProfile(req)).resolves.toEqual({ id: "u1" });
    expect(usersService.delete).toHaveBeenCalledWith("u1");
  });

  it("gets own user by id", async () => {
    const req = { user: { id: "u2", userType: "customer" } };
    usersService.findById.mockResolvedValue({ id: "u2" });
    await expect(controller.getUser("u2", req)).resolves.toEqual({ id: "u2" });
    expect(usersService.findById).toHaveBeenCalledWith("u2");
  });

  it("allows admins to get another user by id", async () => {
    const req = { user: { id: "admin-1", userType: "admin" } };
    usersService.findById.mockResolvedValue({ id: "u2" });
    await expect(controller.getUser("u2", req)).resolves.toEqual({ id: "u2" });
    expect(usersService.findById).toHaveBeenCalledWith("u2");
  });

  it("rejects non-admin access to another user", async () => {
    const req = { user: { id: "u1", userType: "customer" } };
    await expect(controller.getUser("u2", req)).rejects.toThrow(
      new ForbiddenException("Not authorized to view this user"),
    );
    expect(usersService.findById).not.toHaveBeenCalled();
  });
});
