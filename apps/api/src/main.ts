import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  const port = Number(process.env.PORT || 4000);
  const host = "0.0.0.0";

  app.enableShutdownHooks();
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
      (origin) =>
        new RegExp(`^${escapeRegex(origin).replace(/\\\*/g, ".*")}$`),
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
    })
  );

  // Global prefix
  app.setGlobalPrefix("api");

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle("Armut Germany API")
    .setDescription("API documentation for Armut Germany backend")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(port, host);

  console.log(`API running on ${await app.getUrl()}`);
  console.log(`Swagger docs available at ${(await app.getUrl())}/api/docs`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
}

bootstrap();
