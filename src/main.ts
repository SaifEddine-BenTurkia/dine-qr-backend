import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { RedactingLogger } from './common/redacting-logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new RedactingLogger());
  // Exactly one proxy (host nginx) sits between the container and Cloudflare.
  app.set('trust proxy', 1);
  configureApp(app);
  app.enableShutdownHooks();

  const port = Number(app.get(ConfigService).get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`TableQR API listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  new RedactingLogger().error(
    error,
    'TableQR API failed to start',
    'Bootstrap',
  );
  process.exit(1);
});
