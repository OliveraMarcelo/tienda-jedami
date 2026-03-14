import { Pool } from 'pg';
import { ENV } from './env.js';
import { logger } from './logger.js';

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
});

export async function connectDB(): Promise<void> {
  // Testear la conexión antes de continuar
  await pool.query('SELECT 1');
  logger.info('[DATABASE] Conexión a PostgreSQL establecida');

  // Aplicar migraciones pendientes
  const { runMigrations } = await import('../database/migrate.js');
  await runMigrations();
}
