import { type INestApplication, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import {
  httpObservability,
  SafeHttpExceptionFilter,
} from "./common/observability/http-observability";
import { isAllowedOrigin } from "./common/security/cors-origin";

/**
 * HTTP-level configuration shared by `main.ts` and the e2e test harness, so
 * tests exercise the same pipes, prefix, and middleware as the real server.
 */
export function configureApp(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", 1);

  app.use(httpObservability);
  app.useGlobalFilters(new SafeHttpExceptionFilter());

  // Security headers with Helmet
  app.use(helmet());

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Request-ID",
    ],
    exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Request-ID"],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix("api");

  return app;
}
