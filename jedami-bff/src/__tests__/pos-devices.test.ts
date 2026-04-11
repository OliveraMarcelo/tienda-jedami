import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';

const AUTH_BASE = '/api/v1/auth';
const POS_BASE  = '/api/v1/pos';

let adminToken: string;

const ADMIN_HASH = '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm';

async function seedAdmin(): Promise<void> {
  await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ('pos-admin@jedami.com', $1) ON CONFLICT (email) DO NOTHING",
    [ADMIN_HASH],
  );
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT u.id, r.id FROM users u, roles r
     WHERE u.email = 'pos-admin@jedami.com' AND r.name = 'admin'
     ON CONFLICT (user_id, role_id) DO NOTHING`,
  );
}

beforeAll(async () => {
  await seedAdmin();
  const res = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'pos-admin@jedami.com', password: 'admin123' });
  adminToken = res.body.data?.token;
});

beforeEach(async () => {
  await pool.query('DELETE FROM pos_devices');
});

// ─── GET /pos/devices ─────────────────────────────────────────────────────────

describe('GET /pos/devices', () => {
  it('retorna 200 con lista vacía cuando no hay devices', async () => {
    const res = await request(testApp)
      .get(`${POS_BASE}/devices`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('retorna 200 con lista de devices existentes', async () => {
    await pool.query(
      "INSERT INTO pos_devices (mp_device_id, name, operating_mode, active) VALUES ('MP_DEV_001', 'Caja 1', 'PDV', true)",
    );

    const res = await request(testApp)
      .get(`${POS_BASE}/devices`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      mp_device_id: 'MP_DEV_001',
      name: 'Caja 1',
      active: true,
    });
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp).get(`${POS_BASE}/devices`);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /pos/devices/:id ───────────────────────────────────────────────────

describe('PATCH /pos/devices/:id', () => {
  it('actualiza active a false correctamente', async () => {
    const insert = await pool.query(
      "INSERT INTO pos_devices (mp_device_id, name, operating_mode, active) VALUES ('MP_DEV_002', 'Caja 2', 'PDV', true) RETURNING id",
    );
    const deviceId = insert.rows[0].id;

    const res = await request(testApp)
      .patch(`${POS_BASE}/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
    expect(res.body.data.id).toBe(deviceId);
  });

  it('retorna 404 si el device no existe', async () => {
    const res = await request(testApp)
      .patch(`${POS_BASE}/devices/99999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: true });

    expect(res.status).toBe(404);
  });

  it('retorna 400 si active no es booleano', async () => {
    const res = await request(testApp)
      .patch(`${POS_BASE}/devices/1`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: 'yes' });

    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp)
      .patch(`${POS_BASE}/devices/1`)
      .send({ active: true });
    expect(res.status).toBe(401);
  });
});

// ─── GET /config incluye pointDevice ─────────────────────────────────────────

describe('GET /config incluye pointDevice', () => {
  it('retorna pointDevice: null cuando no hay devices activos', async () => {
    const res = await request(testApp).get('/api/v1/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('pointDevice');
    expect(res.body.data.pointDevice).toBeNull();
  });

  it('retorna pointDevice con id y name cuando hay un device activo', async () => {
    await pool.query(
      "INSERT INTO pos_devices (mp_device_id, name, operating_mode, active) VALUES ('MP_DEV_003', 'Terminal Principal', 'PDV', true)",
    );

    // Limpiar cache para forzar re-fetch
    const redis = await import('../config/redis.js');
    await redis.cacheDel('config:all');

    const res = await request(testApp).get('/api/v1/config');
    expect(res.status).toBe(200);
    expect(res.body.data.pointDevice).toMatchObject({ name: 'Terminal Principal' });
    expect(typeof res.body.data.pointDevice.id).toBe('number');
  });
});
