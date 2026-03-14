import pino from 'pino';
import { ENV } from './env.js';

export const logger = pino({
  level: ENV.LOG_LEVEL,
  transport:
    ENV.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
