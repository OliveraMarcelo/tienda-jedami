import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from './helpers/app.js';

const BASE = '/api/v1/products';

describe('GET /products', () => {
  it('retorna 200 con estructura correcta', async () => {
    const res = await request(testApp).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('total');
  });

  it('acepta parámetros de paginación', async () => {
    const res = await request(testApp).get(`${BASE}?page=1&pageSize=5`);
    expect(res.status).toBe(200);
    expect(res.body.meta.pageSize).toBe(5);
  });

  it('acepta parámetro search', async () => {
    const res = await request(testApp).get(`${BASE}?search=remera`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /products/:id', () => {
  it('retorna 404 para producto inexistente', async () => {
    const res = await request(testApp).get(`${BASE}/999999`);
    expect(res.status).toBe(404);
  });

  it('retorna 400 para id inválido', async () => {
    const res = await request(testApp).get(`${BASE}/abc`);
    expect(res.status).toBe(400);
  });
});
