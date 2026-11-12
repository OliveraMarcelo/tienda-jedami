import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testApp } from './helpers/app.js';
import { errorMiddleware } from '../middlewares/error.middleware.js';

describe('Cabeceras de seguridad', () => {
  it('no anuncia Express y manda las cabeceras de helmet', async () => {
    const res = await request(testApp).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('errorMiddleware', () => {
  const app = express();
  app.get('/boom', () => { throw new Error('relation "secret_table" does not exist'); });
  app.use(errorMiddleware);

  it('no expone el mensaje interno en errores 500', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
    expect(res.body.title).toBe('Error interno del servidor');
  });
});
