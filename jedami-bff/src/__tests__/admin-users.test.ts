import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';

const AUTH_BASE  = '/api/v1/auth';
const ADMIN_BASE = '/api/v1/admin';

let adminToken: string;

async function seedAdmin(): Promise<void> {
  const ADMIN_HASH = '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm';
  await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ('admin@jedami.com', $1) ON CONFLICT (email) DO NOTHING",
    [ADMIN_HASH],
  );
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT u.id, r.id FROM users u, roles r
     WHERE u.email = 'admin@jedami.com' AND r.name = 'admin'
     ON CONFLICT (user_id, role_id) DO NOTHING`,
  );
}

beforeAll(async () => {
  await seedAdmin();
  const res = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'admin@jedami.com', password: 'admin123' });
  adminToken = res.body.data?.token;
});

describe('GET /admin/users', () => {
  it('retorna 200 con lista paginada y estructura de paginación correcta', async () => {
    const res = await request(testApp)
      .get(`${ADMIN_BASE}/users?page=1&limit=20`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('users');
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.data.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
      pages: expect.any(Number),
    });
  });

  it('incluye customerType con valor null para usuario sin perfil de customer', async () => {
    await request(testApp)
      .post(`${AUTH_BASE}/register`)
      .send({ email: 'buyer-null@test.com', password: 'Password123!' });

    const res = await request(testApp)
      .get(`${ADMIN_BASE}/users?page=1&limit=20`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const users = res.body.data.users as Array<{ email: string; customerType: unknown }>;
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(u).toHaveProperty('customerType');
    }
  });

  it('incluye customerType con valor retail para usuario registrado como retail', async () => {
    await request(testApp)
      .post(`${AUTH_BASE}/register`)
      .send({ email: 'retail@test.com', password: 'Password123!', customerType: 'retail' });

    const res = await request(testApp)
      .get(`${ADMIN_BASE}/users?page=1&limit=20`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const users = res.body.data.users as Array<{ email: string; customerType: unknown }>;
    expect(users.length).toBeGreaterThan(0);
    const retailUser = users.find(u => u.email === 'retail@test.com');
    expect(retailUser).toBeDefined();
    expect(retailUser!.customerType).toBe('retail');
  });

  it('incluye customerType con valor wholesale para usuario registrado como wholesale', async () => {
    await request(testApp)
      .post(`${AUTH_BASE}/register`)
      .send({ email: 'wholesale@test.com', password: 'Password123!', customerType: 'wholesale' });

    const res = await request(testApp)
      .get(`${ADMIN_BASE}/users?page=1&limit=20`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const users = res.body.data.users as Array<{ email: string; customerType: unknown }>;
    const wholesaleUser = users.find(u => u.email === 'wholesale@test.com');
    expect(wholesaleUser).toBeDefined();
    expect(wholesaleUser!.customerType).toBe('wholesale');
  });

  it('filtra por fecha de alta (rango)', async () => {
    const email = `rango-${Date.now()}@test.com`;
    await request(testApp).post(`${AUTH_BASE}/register`).send({ email, password: 'Password123!' });
    const get = (from: string, to: string) => request(testApp)
      .get(`${ADMIN_BASE}/users`)
      .query({ search: email, date_from: from, date_to: to })
      .set('Authorization', `Bearer ${adminToken}`);

    const now = Date.now();
    const inside = await get(new Date(now - 3600_000).toISOString(), new Date(now + 3600_000).toISOString());
    expect(inside.status).toBe(200);
    expect(inside.body.data.users.map((u: { email: string }) => u.email)).toEqual([email]);
    expect(inside.body.data.pagination.total).toBe(1);

    const before = await get(new Date(now - 7 * 86400_000).toISOString(), new Date(now - 86400_000).toISOString());
    expect(before.body.data.users).toHaveLength(0);
    expect(before.body.data.pagination.total).toBe(0);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp).get(`${ADMIN_BASE}/users?page=1&limit=20`);
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/payments', () => {
  it('busca por email del cliente o por número de pedido', async () => {
    const email = `busqueda-pagos-${Date.now()}@test.com`;
    await request(testApp).post(`${AUTH_BASE}/register`).send({ email, password: 'Password123!' });
    // Mayorista, para poder armar un pedido por curva
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT u.id, r.id FROM users u, roles r WHERE u.email = $1 AND r.name = 'wholesale' ON CONFLICT DO NOTHING`,
      [email],
    );
    await pool.query("UPDATE customers SET customer_type = 'wholesale' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [email]);
    const token = (await request(testApp).post(`${AUTH_BASE}/login`).send({ email, password: 'Password123!' })).body.data.token;
    const order = await request(testApp).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send({ purchaseType: 'curva' });
    const orderId = order.body.data.id;
    expect(orderId).toBeDefined();

    const search = (q: string) => request(testApp)
      .get(`${ADMIN_BASE}/payments`)
      .query({ search: q, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`);

    const byEmail = await search(email);
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.payments.map((p: { orderId: number }) => p.orderId)).toEqual([orderId]);
    expect(byEmail.body.data.pagination.total).toBe(1);

    const byId = await search(`#${orderId}`);
    expect(byId.body.data.payments.map((p: { orderId: number }) => p.orderId)).toEqual([orderId]);

    const none = await search('nadie-con-este-email@x.com');
    expect(none.body.data.pagination.total).toBe(0);
  });
});
