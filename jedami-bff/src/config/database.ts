import { Pool } from 'pg';
import { ENV } from './env.js';
import { logger } from './logger.js';

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
});

export async function connectDB(): Promise<void> {
  // Testear la conexión antes de continuar
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    throw new Error(`No se pudo conectar a PostgreSQL: ${(err as Error).message}`, { cause: err });
  }
  logger.info('[DATABASE] Conexión a PostgreSQL establecida');

  // Aplicar migraciones pendientes
  const { runMigrations } = await import('../database/migrate.js');
  await runMigrations();
}
