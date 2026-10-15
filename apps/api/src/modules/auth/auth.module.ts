import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PasswordRecoveryService } from "./password-recovery.service";
import { RecoveryEmailService } from "./recovery-email.service";
import { SessionService } from "./session.service";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { UsersModule } from "../users/users.module";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { getAuthSecrets } from "../../common/security/auth-config";

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: getAuthSecrets(configService).accessSecret,
        signOptions: {
          expiresIn: "7d" as const,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, SessionService, PasswordRecoveryService, RecoveryEmailService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, SessionService],
})
export class AuthModule {}
