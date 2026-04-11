import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';

const WEBHOOK_URL = '/api/v1/payments/webhook';

const ADMIN_HASH = '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm';

async function createPendingOrderWithPayment(): Promise<{ orderId: number; deviceId: number }> {
  const userRes = await pool.query(
    "INSERT INTO users(email, password_hash) VALUES ('wh-buyer@test.com', $1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
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
    "INSERT INTO orders(customer_id, purchase_type, status, total_amount) VALUES ($1, 'retail', 'pending', 1000) RETURNING id",
    [customerId],
  );
  const orderId = orderRes.rows[0].id;

  const devRes = await pool.query(
    "INSERT INTO pos_devices(mp_device_id, name, operating_mode, active) VALUES ('WH_DEV01', 'Caja WH', 'PDV', true) RETURNING id",
  );
  const deviceId = devRes.rows[0].id;

  await pool.query(
    "INSERT INTO payments(order_id, payment_method, status) VALUES ($1, 'mp_point', 'pending')",
    [orderId],
  );

  return { orderId, deviceId };
}

function webhookBody(intentId: string) {
  return JSON.stringify({ action: 'point_integration_wh', data: { id: intentId } });
}

beforeAll(async () => {
  await pool.query('DELETE FROM pos_payment_intents');
  await pool.query('DELETE FROM payments WHERE payment_method = $1', ['mp_point']);
  await pool.query("DELETE FROM orders WHERE purchase_type = 'retail'");
  await pool.query('DELETE FROM pos_devices');
});

beforeEach(async () => {
  await pool.query('DELETE FROM pos_payment_intents');
  await pool.query('DELETE FROM payments WHERE payment_method = $1', ['mp_point']);
  await pool.query("DELETE FROM orders WHERE purchase_type = 'retail'");
  await pool.query('DELETE FROM pos_devices');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Webhook Point — intent inexistente ───────────────────────────────────────

describe('POST /payments/webhook — action: point_integration_wh', () => {
  it('retorna 200 si el intentId no existe en DB (warn + return)', async () => {
    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'wh-req-1')
      .send(webhookBody('INTENT_NO_EXISTE'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('retorna 200 si el intentId está vacío (sin data.id)', async () => {
    const body = JSON.stringify({ action: 'point_integration_wh', data: {} });
    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'wh-req-2')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  // AC2: webhook con pago aprobado → pedido pasa a paid
  it('AC2: webhook aprobado → order paid, payment approved (mock MP)', async () => {
    const { orderId, deviceId } = await createPendingOrderWithPayment();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_FINISH', 'on_terminal')",
      [deviceId, orderId],
    );

    // Mock de MP API: intent en estado 'finished' con payment id
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'finished', payment: { id: 987654321 } }),
    } as Response);

    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'wh-req-ac2')
      .send(webhookBody('INTENT_FINISH'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.rows[0].status).toBe('paid');

    const payment = await pool.query(
      "SELECT status, paid_at, mp_payment_id FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );
    expect(payment.rows[0].status).toBe('approved');
    expect(payment.rows[0].paid_at).not.toBeNull();
    expect(payment.rows[0].mp_payment_id).toBe('987654321');
  });

  // AC3: webhook con pago rechazado → payment rejected, order sigue pending
  it('AC3: webhook rechazado → payment rejected, order sigue pending (mock MP)', async () => {
    const { orderId, deviceId } = await createPendingOrderWithPayment();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_ABANDONED', 'on_terminal')",
      [deviceId, orderId],
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'abandoned' }),
    } as Response);

    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'wh-req-ac3')
      .send(webhookBody('INTENT_ABANDONED'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.rows[0].status).toBe('pending');

    const payment = await pool.query(
      "SELECT status FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );
    expect(payment.rows[0].status).toBe('rejected');
  });

  // Task 3 (corrección): intent en DB pero MP devuelve estado aún activo (open) → sin cambios
  it('intent en DB pero MP devuelve estado open → order y payment sin cambios (mock MP)', async () => {
    const { orderId, deviceId } = await createPendingOrderWithPayment();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_STILL_OPEN', 'open')",
      [deviceId, orderId],
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'open' }),
    } as Response);

    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'wh-req-open')
      .send(webhookBody('INTENT_STILL_OPEN'));

    expect(res.status).toBe(200);

    const order = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.rows[0].status).toBe('pending');

    const payment = await pool.query(
      "SELECT status FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );
    expect(payment.rows[0].status).toBe('pending');
  });

  it('retorna 200 idempotente: webhook duplicado cuando payment ya es approved', async () => {
    const { orderId, deviceId } = await createPendingOrderWithPayment();

    await pool.query(
      "INSERT INTO pos_payment_intents(device_id, order_id, mp_intent_id, status) VALUES ($1, $2, 'INTENT_APPROVED', 'processed')",
      [deviceId, orderId],
    );

    // Marcar el payment como ya aprobado
    await pool.query(
      "UPDATE payments SET status = 'approved', paid_at = NOW() WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );

    const res = await request(testApp)
      .post(WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'ts=1,v1=abc')
      .set('x-request-id', 'wh-req-3')
      .send(webhookBody('INTENT_APPROVED'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    // El estado no debe haber cambiado
    const payment = await pool.query(
      "SELECT status FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );
    expect(payment.rows[0].status).toBe('approved');
  });
});
