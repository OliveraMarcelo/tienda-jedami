import Redis from 'ioredis';
import { ENV } from './env.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  if (!ENV.REDIS_URL) {
    logger.info('[REDIS] REDIS_URL no configurada — caché desactivado');
    return;
  }

  try {
    const client = new Redis(ENV.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    client.on('error', (err) => {
      logger.warn({ err: err.message }, '[REDIS] Error de conexión — operando sin caché');
    });

    await client.connect();
    redisClient = client;
    logger.info('[REDIS] Conectado correctamente');
  } catch (err) {
    logger.warn({ err }, '[REDIS] No se pudo conectar — operando sin caché');
    redisClient = null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.set(key, value, 'EX', ttlSeconds);
  } catch {
    // silencioso — Redis es opcional
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redisClient) return;
  try {
    const exactKeys = keys.filter(k => !k.includes('*'));
    const wildcardKeys = keys.filter(k => k.includes('*'));

    const expandedWildcardKeys: string[] = [];
    for (const pattern of wildcardKeys) {
      const matched = await redisClient.keys(pattern);
      expandedWildcardKeys.push(...matched);
    }

    const allKeys = [...exactKeys, ...expandedWildcardKeys];
    if (allKeys.length > 0) {
      await redisClient.del(...allKeys);
    }
  } catch {
    // silencioso — Redis es opcional
  }
}
