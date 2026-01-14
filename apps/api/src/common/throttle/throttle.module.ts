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
          {
            // Strict rate limit for auth endpoints: 10 requests per minute
            name: "strict",
            ttl: 60000,
            limit: configService.get("RATE_LIMIT_STRICT") || 10,
          },
          {
            // Relaxed rate limit for public endpoints: 200 requests per minute
            name: "relaxed",
            ttl: 60000,
            limit: configService.get("RATE_LIMIT_RELAXED") || 200,
          },
        ],
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
