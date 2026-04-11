import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = join(__dirname, 'migrations');
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [file]
    );
    if (rows.length > 0) {
      logger.debug(`[MIGRATE] Ya aplicada: ${file}`);
      continue;
    }

    logger.info(`[MIGRATE] Aplicando: ${file}`);
    const sql = await readFile(join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
    await pool.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [file]
    );
    logger.info(`[MIGRATE] OK: ${file}`);
  }

  logger.info('[MIGRATE] Todas las migraciones aplicadas');

  // Garantizar que siempre exista un admin — idempotente
  await pool.query(`
    INSERT INTO users(email, password_hash)
    VALUES ('admin@jedami.com', '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm')
    ON CONFLICT (email) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO user_roles(user_id, role_id)
    SELECT u.id, r.id FROM users u, roles r
    WHERE u.email = 'admin@jedami.com' AND r.name = 'admin'
    ON CONFLICT (user_id, role_id) DO NOTHING
  `);
  logger.info('[MIGRATE] Admin garantizado: admin@jedami.com');
}

// Ejecutar cuando se corre directamente: npm run migrate
const isMain = process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');
if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
