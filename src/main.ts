import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error(
    'Application failed to start',
    error instanceof Error ? error.stack : String(error)
  );

  process.exit(1);
});
