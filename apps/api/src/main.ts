import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { configureApp } from "./app.setup";
import { SafeRuntimeLogger } from "./common/observability/safe-runtime-logger";

const logger = new SafeRuntimeLogger();

async function bootstrap() {
  const { AppModule } = await import("./app.module");
  const app = await NestFactory.create(AppModule, {
    logger,
    abortOnError: false,
  });
  const port = Number(process.env.PORT || 4000);
  const host = "0.0.0.0";

  app.enableShutdownHooks();
  configureApp(app);

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

  console.log(JSON.stringify({ event: "startup_ready" }));
}

void bootstrap().catch(() => {
  logger.startupFailure();
  process.exit(1);
});
