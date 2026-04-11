import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';

const AUTH_BASE = '/api/v1/auth';
const POS_BASE  = '/api/v1/pos';

let adminToken: string;
let testProductId: number;
let testVariantId: number;

const ADMIN_HASH = '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm';

async function seedAdmin(): Promise<void> {
  await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ('intent-admin@jedami.com', $1) ON CONFLICT (email) DO NOTHING",
    [ADMIN_HASH],
  );
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT u.id, r.id FROM users u, roles r
     WHERE u.email = 'intent-admin@jedami.com' AND r.name = 'admin'
     ON CONFLICT (user_id, role_id) DO NOTHING`,
  );
}

async function createPendingOrder(amount = 1000): Promise<number> {
  // Necesita un customer — crear uno
  const userRes = await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ('intent-buyer@test.com', $1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
    [ADMIN_HASH],
  );
  const userId = userRes.rows[0].id;
  await pool.query(
    "INSERT INTO customers(user_id, customer_type) VALUES ($1, 'retail') ON CONFLICT (user_id) DO NOTHING",
    [userId],
  );
  const customerRes = await pool.query('SELECT id FROM customers WHERE user_id = $1', [userId]);
  const customerId = customerRes.rows[0].id;

  const orderRes = await pool.query(
    "INSERT INTO orders(customer_id, purchase_type, status, total_amount) VALUES ($1, 'retail', 'pending', $2) RETURNING id",
    [customerId, amount],
  );
  const orderId = orderRes.rows[0].id;

  if (testVariantId && testProductId) {
    await pool.query(
      'INSERT INTO order_items(order_id, variant_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,1,$4)',
      [orderId, testVariantId, testProductId, amount],
    );
  }

  return orderId;
}

async function createPaidOrder(): Promise<number> {
  const orderId = await createPendingOrder();
  await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
  return orderId;
}

beforeAll(async () => {
  await seedAdmin();
  const res = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'intent-admin@jedami.com', password: 'admin123' });
  adminToken = res.body.data?.token;

  // Obtener variante/producto para order items
  const varRes = await pool.query('SELECT id, product_id FROM variants LIMIT 1');
  if (varRes.rows[0]) {
    testVariantId = varRes.rows[0].id;
    testProductId = varRes.rows[0].product_id;
  }
});

beforeEach(async () => {
  await pool.query('DELETE FROM pos_payment_intents');
  await pool.query('DELETE FROM payments WHERE payment_method = $1', ['mp_point']);
  await pool.query('DELETE FROM orders WHERE purchase_type = $1', ['retail']);
  await pool.query('DELETE FROM pos_devices');
});

// ─── POST /pos/orders/:orderId/intent ─────────────────────────────────────────

describe('POST /pos/orders/:orderId/intent', () => {
  it('retorna 422 si no hay dispositivo activo', async () => {
    const orderId = await createPendingOrder();

    const res = await request(testApp)
      .post(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(422);
    expect(res.body.title ?? res.body.detail).toMatch(/dispositivo/i);
  });

  it('retorna 409 si el pedido ya está pagado', async () => {
    await pool.query(
      "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('DEV001', 'Caja 1', 'PDV', true)",
    );
    const orderId = await createPaidOrder();

    const res = await request(testApp)
      .post(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.title ?? res.body.detail).toMatch(/pagado/i);
  });

  it('retorna 409 si ya existe intent activo para el pedido', async () => {
    const devRes = await pool.query(
      "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('DEV002', 'Caja 2', 'PDV', true) RETURNING id",
    );
    const deviceId = devRes.rows[0].id;
    const orderId = await createPendingOrder();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_EXISTING', 'open')",
      [deviceId, orderId],
    );

    const res = await request(testApp)
      .post(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.title ?? res.body.detail).toMatch(/cobro en progreso/i);
  });

  it('retorna 404 si el pedido no existe', async () => {
    await pool.query(
      "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('DEV003', 'Caja 3', 'PDV', true)",
    );

    const res = await request(testApp)
      .post(`${POS_BASE}/orders/99999/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp).post(`${POS_BASE}/orders/1/intent`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /pos/orders/:orderId/intent ─────────────────────────────────────────

describe('GET /pos/orders/:orderId/intent', () => {
  it('retorna 404 si no hay intent para el pedido', async () => {
    const orderId = await createPendingOrder();

    const res = await request(testApp)
      .get(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('retorna 200 con datos del intent existente', async () => {
    const devRes = await pool.query(
      "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('DEV004', 'Caja 4', 'PDV', true) RETURNING id",
    );
    const deviceId = devRes.rows[0].id;
    const orderId = await createPendingOrder();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_GET_TEST', 'open')",
      [deviceId, orderId],
    );

    const res = await request(testApp)
      .get(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.intent.mp_intent_id).toBe('INTENT_GET_TEST');
    expect(res.body.data.intent.status).toBe('open');
    expect(res.body.data.deviceName).toBe('Caja 4');
  });
});

// ─── DELETE /pos/orders/:orderId/intent ───────────────────────────────────────

describe('DELETE /pos/orders/:orderId/intent', () => {
  it('retorna 404 si no hay intent activo', async () => {
    const orderId = await createPendingOrder();

    const res = await request(testApp)
      .delete(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('marca intent como cancelled (aunque MP falle el DELETE)', async () => {
    const devRes = await pool.query(
      "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('DEV005', 'Caja 5', 'PDV', true) RETURNING id",
    );
    const deviceId = devRes.rows[0].id;
    const orderId = await createPendingOrder();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_CANCEL', 'open')",
      [deviceId, orderId],
    );

    const res = await request(testApp)
      .delete(`${POS_BASE}/orders/${orderId}/intent`)
      .set('Authorization', `Bearer ${adminToken}`);

    // 204 si MP responde OK, o 204 igualmente (warn y sigue)
    expect([204, 204]).toContain(res.status);

    const dbIntent = await pool.query(
      "SELECT status FROM pos_payment_intents WHERE mp_intent_id = 'INTENT_CANCEL'",
    );
    expect(dbIntent.rows[0].status).toBe('cancelled');
  });
});
