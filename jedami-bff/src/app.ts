import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { logger } from './config/logger.js';
import { swaggerSpec } from './config/swagger.js';
import { ENV } from './config/env.js';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { generalRateLimit } from './middlewares/rate-limit.middleware.js';
import { UPLOADS_DIR, UPLOADS_BRANDING_DIR, UPLOADS_BANNERS_DIR, UPLOADS_ANNOUNCEMENTS_DIR } from './config/upload.js';

export function createApp() {
  const app = express();

  // CORS — antes de cualquier ruta
  app.use(cors({
    origin: ENV.CORS_ORIGINS.length === 1 ? ENV.CORS_ORIGINS[0] : ENV.CORS_ORIGINS,
    credentials: true,
  }));

  // HTTP logging — antes de cualquier ruta
  app.use(pinoHttp({ logger }));

  // Rate limiting global
  app.use(generalRateLimit);

  // Guardamos el raw body antes de parsear — necesario para verificar firma del webhook de MP
  app.use(express.json({
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as express.Request & { rawBody: Buffer }).rawBody = buf;
    },
  }));

  // Archivos estáticos — imágenes subidas
  app.use('/uploads/products',      express.static(UPLOADS_DIR));
  app.use('/uploads/branding',      express.static(UPLOADS_BRANDING_DIR));
  app.use('/uploads/banners',       express.static(UPLOADS_BANNERS_DIR));
  app.use('/uploads/announcements', express.static(UPLOADS_ANNOUNCEMENTS_DIR));

  // Documentación API
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Rutas versionadas
  app.use('/api/v1', routes);

  // Error middleware RFC 7807 — ÚLTIMO middleware
  app.use(errorMiddleware);

  return app;
}
