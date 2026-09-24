import { type INestApplication, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * HTTP-level configuration shared by `main.ts` and the e2e test harness, so
 * tests exercise the same pipes, prefix, and middleware as the real server.
 */
export function configureApp(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", 1);

  // Security headers with Helmet
  app.use(helmet());

  // Enable CORS
  const allowedOriginPatterns = (
    process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:8081"]
  )
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(
      (origin) => new RegExp(`^${escapeRegex(origin).replace(/\\\*/g, ".*")}$`),
    );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      const isAllowed = allowedOriginPatterns.some((pattern) =>
        pattern.test(origin),
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit"],
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
