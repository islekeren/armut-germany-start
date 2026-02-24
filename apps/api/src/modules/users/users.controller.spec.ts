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

  it("gets user by id", async () => {
    usersService.findById.mockResolvedValue({ id: "u2" });
    await expect(controller.getUser("u2")).resolves.toEqual({ id: "u2" });
    expect(usersService.findById).toHaveBeenCalledWith("u2");
  });
});
