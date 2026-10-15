import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
  const configService = {
    get: jest.fn((key: string) => ({
      NODE_ENV: "test",
      JWT_SECRET: "jwt-secret",
      JWT_REFRESH_SECRET: "refresh-jwt-secret",
    })[key]),
  };

  const usersService = { findById: jest.fn() };
  const sessions = {
    validate: jest.fn(async () => {
      const user = await usersService.findById();
      if (!user) throw new UnauthorizedException();
      return { id: "s1", user };
    }),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(configService as any, sessions as any);
  });

  it("rejects legacy JWTs even when the account is active", async () => {
    usersService.findById.mockResolvedValue({ id: "u1", email: "u@example.com" });
    await expect(strategy.validate({ sub: "u1" })).rejects.toThrow(UnauthorizedException);
  });

  it("returns sanitized user when payload user exists", async () => {
    usersService.findById.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      password: "secret",
    });

    await expect(strategy.validate({ sub: "u1", sid: "s1", type: "access" })).resolves.toEqual({
      id: "u1",
      email: "u@example.com",
    });
  });

  it("throws unauthorized when payload user does not exist", async () => {
    usersService.findById.mockResolvedValue(null);
    await expect(strategy.validate({ sub: "missing", sid: "s1", type: "access" })).rejects.toThrow(
      UnauthorizedException
    );
  });

  it("refuses to construct HTTP authentication without explicit secrets", () => {
    const missingConfig = { get: () => undefined };
    expect(() => new JwtStrategy(missingConfig as any, sessions as any))
      .toThrow(/JWT_SECRET/);
  });

  it("refuses predictable production secrets without exposing them", () => {
    const values = {
      NODE_ENV: "production",
      JWT_SECRET: "secret",
      JWT_REFRESH_SECRET: "refresh-secret",
    };
    expect(() => new JwtStrategy({ get: (key: string) => values[key] } as any, sessions as any))
      .toThrow(/JWT_SECRET/);
  });
});
