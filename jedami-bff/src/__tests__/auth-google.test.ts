import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { testApp } from './helpers/app.js';
import { ENV } from '../config/env.js';
import { pool } from '../config/database.js';
import { setGoogleVerifierForTests, type GoogleIdentity } from '../modules/auth/auth.google.js';

const BASE = '/api/v1/auth';

// Cada "credential" de prueba es un JSON con la identidad que devolvería Google
const fakeCredential = (id: Partial<GoogleIdentity>) =>
  JSON.stringify({ sub: 'google-123', email: 'mama@gmail.com', emailVerified: true, ...id });

beforeAll(() => {
  ENV.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  setGoogleVerifierForTests(async (credential) => {
    if (credential === 'invalido') throw new Error('firma inválida');
    return JSON.parse(credential) as GoogleIdentity;
  });
});

afterAll(() => {
  ENV.GOOGLE_CLIENT_ID = '';
  setGoogleVerifierForTests(null);
});

describe('POST /auth/google', () => {
  beforeEach(() => { ENV.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'; });

  it('crea una cuenta nueva verificada, sin contraseña, con el tipo elegido', async () => {
    const res = await request(testApp).post(`${BASE}/google`).send({ credential: fakeCredential({}), customerType: 'wholesale' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');

    const { rows } = await pool.query(
      `SELECT u.password_hash, u.email_verified_at, u.google_sub, c.customer_type
       FROM users u JOIN customers c ON c.user_id = u.id WHERE u.email = 'mama@gmail.com'`,
    );
    expect(rows[0]).toMatchObject({ password_hash: null, google_sub: 'google-123', customer_type: 'wholesale' });
    expect(rows[0].email_verified_at).not.toBeNull();

    // La cuenta sin contraseña no puede entrar con contraseña
    const login = await request(testApp).post(`${BASE}/login`).send({ email: 'mama@gmail.com', password: 'cualquiera1' });
    expect(login.status).toBe(401);
  });

  it('la segunda vez entra a la misma cuenta', async () => {
    await request(testApp).post(`${BASE}/google`).send({ credential: fakeCredential({}) });
    const res = await request(testApp).post(`${BASE}/google`).send({ credential: fakeCredential({}) });
    expect(res.status).toBe(200);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE email = 'mama@gmail.com'");
    expect(rows[0].n).toBe(1);
  });

  it('vincula una cuenta existente con el mismo email (sin importar mayúsculas)', async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: 'Mama@Gmail.com', password: 'Password123!' });
    const res = await request(testApp).post(`${BASE}/google`).send({ credential: fakeCredential({}) });
    expect(res.status).toBe(200);
    const { rows } = await pool.query("SELECT google_sub FROM users WHERE LOWER(email) = 'mama@gmail.com'");
    expect(rows).toHaveLength(1);
    expect(rows[0].google_sub).toBe('google-123');
    // y sigue pudiendo entrar con su contraseña
    const login = await request(testApp).post(`${BASE}/login`).send({ email: 'mama@gmail.com', password: 'Password123!' });
    expect(login.status).toBe(200);
  });

  it('rechaza tokens inválidos y emails de Google sin verificar', async () => {
    const bad = await request(testApp).post(`${BASE}/google`).send({ credential: 'invalido' });
    expect(bad.status).toBe(401);
    const unverified = await request(testApp).post(`${BASE}/google`).send({ credential: fakeCredential({ emailVerified: false }) });
    expect(unverified.status).toBe(401);
  });

  it('responde 404 si el login con Google está apagado', async () => {
    ENV.GOOGLE_CLIENT_ID = '';
    const res = await request(testApp).post(`${BASE}/google`).send({ credential: fakeCredential({}) });
    expect(res.status).toBe(404);
  });
});
