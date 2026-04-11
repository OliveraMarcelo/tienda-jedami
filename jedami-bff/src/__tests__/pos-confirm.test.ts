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
    "INSERT INTO users(email, password_hash) VALUES ('confirm-admin@jedami.com', $1) ON CONFLICT (email) DO NOTHING",
    [ADMIN_HASH],
  );
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT u.id, r.id FROM users u, roles r
     WHERE u.email = 'confirm-admin@jedami.com' AND r.name = 'admin'
     ON CONFLICT (user_id, role_id) DO NOTHING`,
  );
}

async function createPendingOrder(amount = 1500): Promise<number> {
  const userRes = await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ('confirm-buyer@test.com', $1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
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
  return orderRes.rows[0].id;
}

beforeAll(async () => {
  await seedAdmin();
  const res = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'confirm-admin@jedami.com', password: 'admin123' });
  adminToken = res.body.data?.token;
});

beforeEach(async () => {
  await pool.query('DELETE FROM pos_payment_intents');
  await pool.query('DELETE FROM payments WHERE payment_method = $1', ['mp_point']);
  await pool.query("DELETE FROM orders WHERE purchase_type = 'retail'");
});

// ─── PATCH /pos/orders/:orderId/confirm ───────────────────────────────────────

describe('PATCH /pos/orders/:orderId/confirm', () => {
  it('confirma pago cieco (sin mpPaymentId): pedido pasa a paid', async () => {
    const orderId = await createPendingOrder();

    const res = await request(testApp)
      .patch(`${POS_BASE}/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.status).toBe('paid');

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.rows[0].status).toBe('paid');

    const payment = await pool.query(
      "SELECT status, paid_at FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );
    expect(payment.rows[0].status).toBe('approved');
    expect(payment.rows[0].paid_at).not.toBeNull();
  });

  it('retorna 409 si el pedido ya está pagado', async () => {
    const orderId = await createPendingOrder();
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);

    const res = await request(testApp)
      .patch(`${POS_BASE}/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.title ?? res.body.detail).toMatch(/pagado/i);
  });

  it('retorna 404 si el pedido no existe', async () => {
    const res = await request(testApp)
      .patch(`${POS_BASE}/orders/99999/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp).patch(`${POS_BASE}/orders/1/confirm`).send({});
    expect(res.status).toBe(401);
  });

  it('actualiza intent activo a processed al confirmar', async () => {
    const orderId = await createPendingOrder();
    const devRes = await pool.query(
      "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('CFM_DEV01', 'Caja CFM', 'PDV', true) RETURNING id",
    );
    const deviceId = devRes.rows[0].id;

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_CFM', 'on_terminal')",
      [deviceId, orderId],
    );

    const res = await request(testApp)
      .patch(`${POS_BASE}/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);

    const intent = await pool.query(
      "SELECT status FROM pos_payment_intents WHERE mp_intent_id = 'INTENT_CFM'",
    );
    expect(intent.rows[0].status).toBe('processed');
  });
});
