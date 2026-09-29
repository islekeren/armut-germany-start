import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  console.log(`API running on ${await app.getUrl()}`);
  console.log(`Swagger docs available at ${(await app.getUrl())}/api/docs`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
}

bootstrap();
