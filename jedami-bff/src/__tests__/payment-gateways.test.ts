import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';

const AUTH_BASE    = '/api/v1/auth';
const CONFIG_BASE  = '/api/v1/config';
const PAYMENTS_BASE = '/api/v1/payments';

let adminToken: string;
let retailToken: string;
let retailUserId: number;
let wholesaleToken: string;
let wholesaleUserId: number;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function registerUserOnce(
  email: string,
  customerType: 'retail' | 'wholesale',
  roleName: string,
): Promise<{ token: string; userId: number }> {
  // Solo HTTP en beforeAll — un único par register+login por usuario
  const regRes = await request(testApp)
    .post(`${AUTH_BASE}/register`)
    .send({ email, password: 'Password123!' });
  const userId: number = regRes.body.data?.id;
  if (!userId) throw new Error(`No se pudo registrar ${email}`);

  const rolesRes = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
  const roleId = rolesRes.rows[0]?.id;
  if (roleId) {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId],
    );
  }
  await pool.query(
    'INSERT INTO customers (user_id, customer_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, customerType],
  );

  const loginRes = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email, password: 'Password123!' });
  return { token: loginRes.body.data?.token, userId };
}

/** Restaura customers y user_roles vía SQL directo (sin HTTP) para evitar rate-limit */
async function reseedTestUsers(
  adminUserId: number,
  retailUserId_: number,
  wholesaleUserId_: number,
): Promise<void> {
  const ADMIN_HASH = '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm';

  // Restaurar admin
  await pool.query(
    "INSERT INTO users(id, email, password_hash) VALUES ($1, 'admin@jedami.com', $2) ON CONFLICT (email) DO NOTHING",
    [adminUserId, ADMIN_HASH],
  );
  // Restaurar retail user
  await pool.query(
    "INSERT INTO users(id, email, password_hash) VALUES ($1, 'pgr-retail@test.com', $2) ON CONFLICT (email) DO NOTHING",
    [retailUserId_, ADMIN_HASH],
  );
  // Restaurar wholesale user
  await pool.query(
    "INSERT INTO users(id, email, password_hash) VALUES ($1, 'pgr-wholesale@test.com', $2) ON CONFLICT (email) DO NOTHING",
    [wholesaleUserId_, ADMIN_HASH],
  );

  // Restaurar roles
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT $1, r.id FROM roles r WHERE r.name = 'admin'
     ON CONFLICT DO NOTHING`,
    [adminUserId],
  );
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT $1, r.id FROM roles r WHERE r.name = 'retail'
     ON CONFLICT DO NOTHING`,
    [retailUserId_],
  );
  await pool.query(
    `INSERT INTO user_roles(user_id, role_id)
     SELECT $1, r.id FROM roles r WHERE r.name = 'wholesale'
     ON CONFLICT DO NOTHING`,
    [wholesaleUserId_],
  );

  // Restaurar customers
  await pool.query(
    "INSERT INTO customers(user_id, customer_type) VALUES ($1, 'retail') ON CONFLICT DO NOTHING",
    [retailUserId_],
  );
  await pool.query(
    "INSERT INTO customers(user_id, customer_type) VALUES ($1, 'wholesale') ON CONFLICT DO NOTHING",
    [wholesaleUserId_],
  );
}

async function upsertGatewayRule(
  customerType: 'retail' | 'wholesale',
  gateway: string,
  active: boolean,
): Promise<void> {
  await pool.query(
    `INSERT INTO payment_gateway_rules (customer_type, gateway, active)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_type, gateway) DO UPDATE SET active = $3, updated_at = NOW()`,
    [customerType, gateway, active],
  );
}

async function deleteGatewayRules(): Promise<void> {
  await pool.query('DELETE FROM payment_gateway_rules');
}

async function createOrder(
  customerType: 'retail' | 'wholesale',
  _token: string,
): Promise<number> {
  // Crear un pedido simple usando el endpoint de órdenes retail si es retail, o wholesale si es wholesale
  // Para simplificar, insertamos directamente en la base de datos
  const customerRes = await pool.query(
    `SELECT c.id FROM customers c
     JOIN users u ON c.user_id = u.id
     WHERE c.customer_type = $1 LIMIT 1`,
    [customerType],
  );
  const customerId = customerRes.rows[0]?.id;
  if (!customerId) throw new Error(`No customer found for type ${customerType}`);

  // Buscar una variante existente para el item
  const variantRes = await pool.query('SELECT id FROM variants LIMIT 1');
  const variantId = variantRes.rows[0]?.id;

  // Buscar un producto existente
  const productRes = await pool.query('SELECT id FROM products LIMIT 1');
  const productId = productRes.rows[0]?.id;

  const orderRes = await pool.query(
    `INSERT INTO orders (customer_id, purchase_type, status, total_amount)
     VALUES ($1, 'retail', 'pending', 1000)
     RETURNING id`,
    [customerId],
  );
  const orderId = orderRes.rows[0].id;

  if (variantId && productId) {
    await pool.query(
      `INSERT INTO order_items (order_id, variant_id, product_id, quantity, unit_price)
       VALUES ($1, $2, $3, 1, 1000)`,
      [orderId, variantId, productId],
    );
  }

  return orderId;
}

// ─── Setup global ─────────────────────────────────────────────────────────────

let adminUserId_: number;

beforeAll(async () => {
  // Registrar usuarios UNA sola vez via HTTP (para obtener tokens válidos)
  await seedAdmin();
  const adminRes = await pool.query("SELECT id FROM users WHERE email = 'admin@jedami.com'");
  adminUserId_ = adminRes.rows[0].id;

  const adminLogin = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'admin@jedami.com', password: 'admin123' });
  adminToken = adminLogin.body.data?.token;

  const retail = await registerUserOnce('pgr-retail@test.com', 'retail', 'retail');
  retailToken = retail.token;
  retailUserId = retail.userId;

  const wholesale = await registerUserOnce('pgr-wholesale@test.com', 'wholesale', 'wholesale');
  wholesaleToken = wholesale.token;
  wholesaleUserId = wholesale.userId;
});

beforeEach(async () => {
  // Limpiar reglas antes de cada test para aislar estado
  await deleteGatewayRules();
  // Restaurar users/customers via SQL directo (sin HTTP, sin rate-limit)
  await reseedTestUsers(adminUserId_, retailUserId, wholesaleUserId);
});

// ─── GET /config/payment-gateways ─────────────────────────────────────────────

describe('GET /config/payment-gateways', () => {
  it('retorna 200 con rules agrupados por customer_type', async () => {
    await upsertGatewayRule('retail', 'checkout_pro', true);
    await upsertGatewayRule('wholesale', 'bank_transfer', true);
    await upsertGatewayRule('wholesale', 'checkout_api', false);

    const res = await request(testApp)
      .get(`${CONFIG_BASE}/payment-gateways`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('retail');
    expect(res.body.data).toHaveProperty('wholesale');
    expect(res.body.data.retail).toEqual(
      expect.arrayContaining([expect.objectContaining({ gateway: 'checkout_pro', active: true })]),
    );
    expect(res.body.data.wholesale.length).toBe(2);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp).get(`${CONFIG_BASE}/payment-gateways`);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /config/payment-gateways ───────────────────────────────────────────

describe('PATCH /config/payment-gateways', () => {
  it('crea o actualiza una regla correctamente', async () => {
    const res = await request(testApp)
      .patch(`${CONFIG_BASE}/payment-gateways`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_type: 'retail', gateway: 'bank_transfer', active: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      customer_type: 'retail',
      gateway:       'bank_transfer',
      active:        true,
    });
  });

  it('actualiza una regla existente (toggle active)', async () => {
    await upsertGatewayRule('wholesale', 'checkout_pro', true);

    const res = await request(testApp)
      .patch(`${CONFIG_BASE}/payment-gateways`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_type: 'wholesale', gateway: 'checkout_pro', active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('retorna 400 con gateway inválido', async () => {
    const res = await request(testApp)
      .patch(`${CONFIG_BASE}/payment-gateways`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_type: 'retail', gateway: 'paypal', active: true });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('gateway inválido');
  });

  it('retorna 400 con customer_type inválido', async () => {
    const res = await request(testApp)
      .patch(`${CONFIG_BASE}/payment-gateways`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_type: 'guest', gateway: 'checkout_pro', active: true });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('customer_type inválido');
  });

  it('retorna 401 sin token de admin', async () => {
    const res = await request(testApp)
      .patch(`${CONFIG_BASE}/payment-gateways`)
      .send({ customer_type: 'retail', gateway: 'checkout_pro', active: true });

    expect(res.status).toBe(401);
  });
});

// ─── GET /config incluye paymentGatewayRules ──────────────────────────────────

describe('GET /config incluye paymentGatewayRules', () => {
  it('incluye la clave paymentGatewayRules en el response', async () => {
    await upsertGatewayRule('retail', 'checkout_pro', true);

    const res = await request(testApp).get(`${CONFIG_BASE}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('paymentGatewayRules');
  });
});

// ─── POST /payments/checkout ──────────────────────────────────────────────────

describe('POST /payments/checkout', () => {
  it('retorna 422 si no hay gateways activos para el customer_type', async () => {
    // No insertar ninguna regla activa
    await upsertGatewayRule('retail', 'checkout_pro', false);

    const orderId = await createOrder('retail', retailToken);

    const res = await request(testApp)
      .post(`${PAYMENTS_BASE}/checkout`)
      .set('Authorization', `Bearer ${retailToken}`)
      .send({ orderId });

    expect(res.status).toBe(422);
    expect(res.body.title ?? res.body.detail).toMatch(/sin medios|no hay medios/i);
  });

  it('retorna type:select cuando hay múltiples gateways activos para wholesale', async () => {
    await upsertGatewayRule('wholesale', 'checkout_pro', true);
    await upsertGatewayRule('wholesale', 'bank_transfer', true);

    const orderId = await createOrder('wholesale', wholesaleToken);

    const res = await request(testApp)
      .post(`${PAYMENTS_BASE}/checkout`)
      .set('Authorization', `Bearer ${wholesaleToken}`)
      .send({ orderId });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('select');
    expect(Array.isArray(res.body.data.options)).toBe(true);
    expect(res.body.data.options.length).toBeGreaterThanOrEqual(2);
  });

  it('usa el gateway elegido cuando selectedGateway es válido y activo', async () => {
    await upsertGatewayRule('wholesale', 'checkout_pro', true);
    await upsertGatewayRule('wholesale', 'bank_transfer', true);

    const orderId = await createOrder('wholesale', wholesaleToken);

    const res = await request(testApp)
      .post(`${PAYMENTS_BASE}/checkout`)
      .set('Authorization', `Bearer ${wholesaleToken}`)
      .send({ orderId, selectedGateway: 'bank_transfer' });

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('bank_transfer');
  });

  it('retorna 422 si selectedGateway no está activo para el customer_type', async () => {
    await upsertGatewayRule('retail', 'checkout_pro', true);

    const orderId = await createOrder('retail', retailToken);

    const res = await request(testApp)
      .post(`${PAYMENTS_BASE}/checkout`)
      .set('Authorization', `Bearer ${retailToken}`)
      .send({ orderId, selectedGateway: 'bank_transfer' });

    expect(res.status).toBe(422);
  });

  it('retorna 422 si orderId es inválido', async () => {
    const res = await request(testApp)
      .post(`${PAYMENTS_BASE}/checkout`)
      .set('Authorization', `Bearer ${retailToken}`)
      .send({ orderId: -1 });

    expect(res.status).toBe(400);
  });

  it('retorna 401 sin autenticación', async () => {
    const res = await request(testApp)
      .post(`${PAYMENTS_BASE}/checkout`)
      .send({ orderId: 1 });

    expect(res.status).toBe(401);
  });
});
