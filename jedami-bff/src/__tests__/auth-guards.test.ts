import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { testApp } from './helpers/app.js';

const AUTH_BASE = '/api/v1/auth';
const ADMIN_BASE = '/api/v1/admin';

let regularToken: string;

beforeAll(async () => {
  // Registrar usuario normal
  const res = await request(testApp)
    .post(`${AUTH_BASE}/register`)
    .send({ email: 'regular@test.com', password: 'Password123!' });
  regularToken = res.body.data?.token;
});

describe('Auth guards', () => {
  it('retorna 401 al acceder a ruta protegida sin token', async () => {
    const res = await request(testApp).get(`${ADMIN_BASE}/dashboard`);
    expect(res.status).toBe(401);
  });

  it('retorna 401 con token inválido', async () => {
    const res = await request(testApp)
      .get(`${ADMIN_BASE}/dashboard`)
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('retorna 403 con token válido pero sin rol admin', async () => {
    const res = await request(testApp)
      .get(`${ADMIN_BASE}/dashboard`)
      .set('Authorization', `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });
});
