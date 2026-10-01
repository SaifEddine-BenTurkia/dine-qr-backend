import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/** HTTP setup shared by main.ts and the end-to-end tests. */
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const logger = new Logger('HTTP');
  const production = config.get<string>('NODE_ENV') === 'production';

  app.use(
    helmet({
      // JSON API: no HTML is served, so no CSP to configure. Cross-origin
      // resource policy must allow the frontend on another origin.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    (
      req: { method: string; originalUrl: string },
      res: { statusCode: number; on: (event: string, cb: () => void) => void },
      next: () => void,
    ) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        logger.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`,
        );
      });
      next();
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    // Development accepts any origin; production only the listed frontends.
    origin: production ? origins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}
