import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { UserType } from "./dto/auth.dto";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../common/prisma/prisma.service";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let prisma: { user: { update: jest.Mock } };

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    password: "hashedPassword",
    firstName: "Max",
    lastName: "Mustermann",
    phone: "+491234567890",
    userType: "customer" as const,
    profileImage: null,
    isVerified: true,
    gdprConsent: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: "test-secret",
          JWT_REFRESH_SECRET: "test-refresh-secret",
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    prisma = {
      user: {
        update: jest.fn(),
      },
    };

    service = new AuthService(
      usersService,
      jwtService,
      configService,
      prisma as unknown as PrismaService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    const registerDto = {
      email: "new@example.com",
      password: "Password123!",
      firstName: "Max",
      lastName: "Mustermann",
      phone: "+491234567890",
      userType: UserType.CUSTOMER,
      gdprConsent: true,
    };

    it("should register a new user successfully", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue("mock-token");
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword");

      const result = await service.register(registerDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith("new@example.com");
      expect(usersService.create).toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user).toBeDefined();
    });

    it("should throw ConflictException if email already exists", async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue("mock-token");
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: "test@example.com",
        password: "correctPassword",
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user.email).toBe(mockUser.email);
    });

    it("should throw UnauthorizedException for invalid email", async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: "wrong@example.com",
          password: "password",
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for invalid password", async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: "test@example.com",
          password: "wrongPassword",
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("refreshToken", () => {
    it("should refresh tokens successfully", async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id });
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue("new-mock-token");

      const result = await service.refreshToken("valid-refresh-token");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("should throw UnauthorizedException for invalid refresh token", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException when token is valid but user does not exist", async () => {
      jwtService.verify.mockReturnValue({ sub: "missing-user" });
      usersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken("valid-token")).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe("changePassword", () => {
    it("should throw UnauthorizedException when user is missing", async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword("missing-user", {
          currentPassword: "old",
          newPassword: "new",
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException when current password is wrong", async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: "wrong",
          newPassword: "new",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should update password when current password is valid", async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue("next-hash");

      const result = await service.changePassword(mockUser.id, {
        currentPassword: "old",
        newPassword: "new",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { password: "next-hash" },
      });
      expect(result).toEqual({ message: "Password changed successfully" });
    });
  });

  describe("logout", () => {
    it("should return a success message", async () => {
      await expect(service.logout(mockUser.id)).resolves.toEqual({
        message: "Logged out successfully",
      });
    });
  });

  describe("validateUser", () => {
    it("should return null when user does not exist", async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.validateUser("missing")).resolves.toBeNull();
    });

    it("should return sanitized user when user exists", async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.id);

      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        })
      );
      expect(result).not.toHaveProperty("password");
    });
  });
});
