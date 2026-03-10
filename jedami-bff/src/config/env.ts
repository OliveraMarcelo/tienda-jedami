import dotenv from 'dotenv';

dotenv.config();


console.log('[ENV] Cargando variables de entorno...');
console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL ? 'definida' : 'NO DEFINIDA');
console.log('[ENV] JWT_SECRET:', process.env.JWT_SECRET ? 'definida' : 'NO DEFINIDA');
console.log('[ENV] JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN ? 'definida' : 'NO DEFINIDA');

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN as string,
};

if (!ENV.DATABASE_URL) {
  console.error('[ENV ERROR] DATABASE_URL no está definida');
  throw new Error('DATABASE_URL no está definida');
}
if (!ENV.JWT_SECRET) {
  console.error('[ENV ERROR] JWT_SECRET no está definido');
  throw new Error('JWT_SECRET no está definido');
}
if (!ENV.JWT_EXPIRES_IN) {
  console.error('[ENV ERROR] JWT_EXPIRES_IN no está definido');
  throw new Error('JWT_EXPIRES_IN no está definido');
}

console.log('[ENV] Variables cargadas exitosamente');