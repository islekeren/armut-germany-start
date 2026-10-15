import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { SessionService } from "./session.service";
import { accountEvents } from "../../common/security/account-events";
import { RegisterDto, LoginDto, ChangePasswordDto } from "./dto/auth.dto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { sanitizeUserResponse } from "../../common/security";
import { getAuthSecrets, type AuthSecrets } from "../../common/security/auth-config";

@Injectable()
export class AuthService {
  private readonly authSecrets: AuthSecrets;
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private sessions: SessionService
  ) {
    this.authSecrets = getAuthSecrets(configService);
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const tokens = await this.startSession(user.id, 0);

    return {
      user: sanitizeUserResponse(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.startSession(user.id, user.authVersion);

    return {
      user: sanitizeUserResponse(user),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.authSecrets.refreshSecret,
        algorithms: ["HS256"],
      });

      if (payload.type !== "refresh") throw new UnauthorizedException();
      const session = await this.sessions.validate(payload.sub, payload.sid);
      const user = session.user;
      const tokens = await this.generateTokens(user.id, session.id, session.expiresAt);

      return {
        user: sanitizeUserResponse(user),
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new BadRequestException("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, deletedAt: null, authVersion: user.authVersion },
        data: { password: hashedPassword, authVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new UnauthorizedException();
      await tx.passwordResetToken.deleteMany({ where: { userId } });
    });
    accountEvents.emit("sessionsRevoked", userId);

    return { message: "Password changed successfully" };
  }

  async logout(userId: string, sessionId: string) {
    await this.sessions.revoke(userId, sessionId);
    return { message: "Logged out successfully" };
  }

  async validateUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return null;
    }
    return sanitizeUserResponse(user);
  }

  private async startSession(userId: string, authVersion: number) {
    const session = await this.sessions.create(userId, authVersion);
    return this.generateTokens(userId, session.id, session.expiresAt);
  }

  private async generateTokens(userId: string, sessionId: string, expiresAt: Date) {
    const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    if (remaining <= 0) throw new UnauthorizedException();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, sid: sessionId, type: "access" },
        {
          expiresIn: Math.min(900, remaining),
          secret: this.authSecrets.accessSecret,
        }
      ),
      this.jwtService.signAsync(
        { sub: userId, sid: sessionId, type: "refresh" },
        {
          expiresIn: remaining,
          secret: this.authSecrets.refreshSecret,
        }
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
