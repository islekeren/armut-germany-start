import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
  const configService = {
    get: jest.fn().mockReturnValue("jwt-secret"),
  };

  const usersService = {
    findById: jest.fn(),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(configService as any, usersService as any);
  });

  it("returns sanitized user when payload user exists", async () => {
    usersService.findById.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      password: "secret",
    });

    await expect(strategy.validate({ sub: "u1" })).resolves.toEqual({
      id: "u1",
      email: "u@example.com",
    });
  });

  it("throws unauthorized when payload user does not exist", async () => {
    usersService.findById.mockResolvedValue(null);
    await expect(strategy.validate({ sub: "missing" })).rejects.toThrow(
      UnauthorizedException
    );
  });
});
