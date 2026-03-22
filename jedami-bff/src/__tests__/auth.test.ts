import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { testApp } from './helpers/app.js';

const BASE = '/api/v1/auth';
const EMAIL = 'auth-test@example.com';
const PASSWORD = 'Password123!';

describe('POST /auth/register', () => {
  it('registra un usuario nuevo y retorna token', async () => {
    const res = await request(testApp)
      .post(`${BASE}/register`)
      .send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('token');
  });

  it('rechaza email duplicado con 409', async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    const res = await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('rechaza request sin email con 400', async () => {
    const res = await request(testApp).post(`${BASE}/register`).send({ password: PASSWORD });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
  });

  it('retorna token con credenciales correctas', async () => {
    const res = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  it('rechaza password incorrecto con 401', async () => {
    const res = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rechaza usuario inexistente con 401', async () => {
    const res = await request(testApp).post(`${BASE}/login`).send({ email: 'noexiste@test.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });
});
