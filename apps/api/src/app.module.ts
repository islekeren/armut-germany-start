import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { CacheModule } from "./common/cache/cache.module";
import { ThrottleModule } from "./common/throttle/throttle.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ServicesModule } from "./modules/services/services.module";
import { AdminModule } from "./modules/admin/admin.module";
import { RequestsModule } from "./modules/requests/requests.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ProvidersModule } from "./modules/providers/providers.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    CacheModule,
    ThrottleModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    AdminModule,
    RequestsModule,
    CategoriesModule,
    ProvidersModule,
  ],
})
export class AppModule {}
