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

export function createApp() {
  const app = express();

  // CORS — antes de cualquier ruta
  app.use(cors({
    origin: ENV.CORS_ORIGIN,
    credentials: true,
  }));

  // HTTP logging — antes de cualquier ruta
  app.use(pinoHttp({ logger }));

  // Rate limiting global
  app.use(generalRateLimit);

  app.use(express.json());

  // Documentación API
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Rutas versionadas
  app.use('/api/v1', routes);

  // Error middleware RFC 7807 — ÚLTIMO middleware
  app.use(errorMiddleware);

  return app;
}
