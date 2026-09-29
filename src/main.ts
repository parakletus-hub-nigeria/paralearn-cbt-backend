import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("CBT-Microservice");
  const app = await NestFactory.create(AppModule);

  // Global validation pipe for all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Enable CORS for cbt.pln.ng and school subdomains
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Workspace-Id", "X-Room-Code"],
  });

  // Swagger OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle("ParaLearn CBT Microservice API")
    .setDescription("Autonomous Computer-Based Testing engine with real-time proctoring and dual-auth")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 CBT Microservice listening at http://localhost:${port}`);
  logger.log(`📑 OpenAPI Documentation at http://localhost:${port}/api/docs`);
}

bootstrap();
