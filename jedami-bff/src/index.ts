import 'reflect-metadata';

import { createApp } from './app.js';
import { connectDB } from './config/database.js';
import { AppDataSource } from './config/typeorm.js';
import { ENV } from './config/env.js';

async function bootstrap() {
  try {
    console.log('[BOOTSTRAP] Iniciando aplicación...');
    
    await connectDB();
    console.log('[BOOTSTRAP] PostgreSQL conectado');

    await AppDataSource.initialize();
    console.log('[BOOTSTRAP] TypeORM inicializado');

    const app = createApp();

    app.listen(ENV.PORT, () => {
      console.log(`[BOOTSTRAP] Servidor corriendo en puerto ${ENV.PORT}`);
    });
  } catch (err) {
    console.error('[BOOTSTRAP ERROR] Error fatal:', err);
    process.exit(1);
  }
}

bootstrap();
