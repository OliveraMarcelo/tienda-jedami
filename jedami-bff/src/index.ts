import { createApp } from './app.js';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { runMigrations } from './database/migrate.js';
import { logger } from './config/logger.js';
import { ENV } from './config/env.js';

async function bootstrap() {
  try {
    logger.info('[BOOTSTRAP] Iniciando aplicación...');

    await connectDB();
    logger.info('[BOOTSTRAP] PostgreSQL conectado');

    await runMigrations();
    logger.info('[BOOTSTRAP] Migraciones aplicadas');

    await connectRedis();

    const app = createApp();

    app.listen(ENV.PORT, () => {
      logger.info(`[BOOTSTRAP] Servidor corriendo en puerto ${ENV.PORT}`);
      logger.info(`[BOOTSTRAP] Docs disponibles en http://localhost:${ENV.PORT}/api/docs`);
    });
  } catch (err) {
    logger.error({ err }, '[BOOTSTRAP ERROR] Error fatal');
    process.exit(1);
  }
}

bootstrap();
