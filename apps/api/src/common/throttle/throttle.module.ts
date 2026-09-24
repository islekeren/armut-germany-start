import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            // Default rate limit: 100 requests per minute
            name: "default",
            ttl: 60000,
            limit: configService.get("RATE_LIMIT_DEFAULT") || 100,
          },
        ],
        // Escape hatch for browser e2e runs, where many users log in from
        // one IP. Only honoured when NODE_ENV=test.
        skipIf: () =>
          process.env.NODE_ENV === "test" &&
          process.env.THROTTLE_DISABLED === "true",
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class ThrottleModule {}
