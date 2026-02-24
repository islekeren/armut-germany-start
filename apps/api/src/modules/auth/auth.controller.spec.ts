import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    changePassword: jest.fn(),
    logout: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService as any);
  });

  it("registers a user", async () => {
    const dto: any = { email: "test@example.com", password: "Password123!" };
    authService.register.mockResolvedValue({ id: "u1" });
    await expect(controller.register(dto)).resolves.toEqual({ id: "u1" });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it("logs in user", async () => {
    const dto: any = { email: "test@example.com", password: "Password123!" };
    authService.login.mockResolvedValue({ accessToken: "token" });
    await expect(controller.login(dto)).resolves.toEqual({ accessToken: "token" });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it("refreshes token", async () => {
    authService.refreshToken.mockResolvedValue({ accessToken: "new" });
    await expect(
      controller.refresh({ refreshToken: "refresh-token" } as any)
    ).resolves.toEqual({ accessToken: "new" });
    expect(authService.refreshToken).toHaveBeenCalledWith("refresh-token");
  });

  it("changes password for current user", async () => {
    const req = { user: { id: "u1" } };
    const dto: any = { currentPassword: "old", newPassword: "new" };
    authService.changePassword.mockResolvedValue({ message: "ok" });

    await expect(controller.changePassword(req, dto)).resolves.toEqual({
      message: "ok",
    });
    expect(authService.changePassword).toHaveBeenCalledWith("u1", dto);
  });

  it("logs out current user", async () => {
    const req = { user: { id: "u1" } };
    authService.logout.mockResolvedValue({ message: "Logged out successfully" });

    await expect(controller.logout(req)).resolves.toEqual({
      message: "Logged out successfully",
    });
    expect(authService.logout).toHaveBeenCalledWith("u1");
  });

  it("returns current user on me endpoint", async () => {
    const req = { user: { id: "u1", email: "a@b.c" } };
    await expect(controller.getMe(req)).resolves.toEqual(req.user);
  });
});
