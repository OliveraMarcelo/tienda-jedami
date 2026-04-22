import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';

const AUTH_BASE = '/api/v1/auth';
const PRODUCTS_BASE = '/api/v1/products';
const ADMIN_BASE = '/api/v1/admin';
const ORDERS_BASE = '/api/v1/orders';

let adminToken: string;
let productId: number;
let wholesaleToken: string;

// ─── Setup global ─────────────────────────────────────────────────────────────

// Helper: re-crea admin (puede haber sido truncado por afterEach de otro test)
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

// Helper: re-crea wholesale user y devuelve token + id
async function setupWholesaleUser(): Promise<{ token: string; userId: number }> {
  const regRes = await request(testApp)
    .post(`${AUTH_BASE}/register`)
    .send({ email: 'discount-wholesale@test.com', password: 'Password123!' });
  const userId: number = regRes.body.data?.id;

  // Asignar rol y customer ANTES de hacer login (el JWT incluye roles al momento del login)
  if (userId) {
    const rolesRes = await pool.query("SELECT id FROM roles WHERE name = 'wholesale'");
    const roleId = rolesRes.rows[0]?.id;
    if (roleId) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleId],
      );
      await pool.query(
        "INSERT INTO customers (user_id, customer_type) VALUES ($1, 'wholesale') ON CONFLICT DO NOTHING",
        [userId],
      );
    }
  }

  const loginRes = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'discount-wholesale@test.com', password: 'Password123!' });
  const token: string = loginRes.body.data?.token;

  return { token, userId };
}

beforeAll(async () => {
  // Re-sembrar admin (puede haber sido truncado por otro suite)
  await seedAdmin();

  // Login como admin
  const loginRes = await request(testApp)
    .post(`${AUTH_BASE}/login`)
    .send({ email: 'admin@jedami.com', password: 'admin123' });
  adminToken = loginRes.body.data?.token;

  // Obtener un producto existente del seed
  const productsRes = await request(testApp).get(PRODUCTS_BASE);
  productId = productsRes.body.data?.[0]?.id;

  // Setup wholesale user inicial
  const ws = await setupWholesaleUser();
  wholesaleToken = ws.token;

});

// ─── Discount rules — Public endpoint ────────────────────────────────────────

describe('GET /products/:id/discount-rules (público)', () => {
  it('retorna 200 con listas vacías si no hay escalones', async () => {
    const res = await request(testApp).get(`${PRODUCTS_BASE}/${productId}/discount-rules`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('quantityRules');
    expect(res.body.data).toHaveProperty('curvaRules');
    expect(Array.isArray(res.body.data.quantityRules)).toBe(true);
    expect(Array.isArray(res.body.data.curvaRules)).toBe(true);
  });

  it('retorna 400 con id de producto inválido', async () => {
    const res = await request(testApp).get(`${PRODUCTS_BASE}/abc/discount-rules`);
    expect(res.status).toBe(400);
  });
});

// ─── Admin — Quantity rules ───────────────────────────────────────────────────

describe('POST /admin/products/:id/discount-rules/quantity', () => {
  it('crea escalón de cantidad correctamente', async () => {
    const res = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50, discountPct: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      product_id: productId,
      min_quantity: 50,
    });
    expect(Number(res.body.data.discount_pct)).toBe(10);
  });

  it('retorna 409 al crear escalón duplicado (mismo minQuantity)', async () => {
    await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50, discountPct: 10 });

    const res = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50, discountPct: 15 });

    expect(res.status).toBe(409);
  });

  it('retorna 400 con discountPct inválido (>= 100)', async () => {
    const res = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50, discountPct: 100 });

    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .send({ minQuantity: 50, discountPct: 10 });
    expect(res.status).toBe(401);
  });
});

describe('GET /products/:id/discount-rules después de crear escalones', () => {
  beforeEach(async () => {
    await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50, discountPct: 10 });
    await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/curva`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minCurves: 5, discountPct: 15 });
  });

  it('retorna los escalones activos creados', async () => {
    const res = await request(testApp).get(`${PRODUCTS_BASE}/${productId}/discount-rules`);
    expect(res.status).toBe(200);
    expect(res.body.data.quantityRules).toHaveLength(1);
    expect(res.body.data.curvaRules).toHaveLength(1);
    expect(Number(res.body.data.quantityRules[0].discount_pct)).toBe(10);
    expect(Number(res.body.data.curvaRules[0].discount_pct)).toBe(15);
  });
});

describe('DELETE /admin/products/:id/discount-rules/quantity/:ruleId', () => {
  it('elimina el escalón correctamente', async () => {
    const createRes = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 30, discountPct: 5 });
    const ruleId = createRes.body.data.id;

    const deleteRes = await request(testApp)
      .delete(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    // Verificar que ya no aparece en la lista pública
    const listRes = await request(testApp).get(`${PRODUCTS_BASE}/${productId}/discount-rules`);
    const ids = listRes.body.data.quantityRules.map((r: { id: number }) => r.id);
    expect(ids).not.toContain(ruleId);
  });

  it('retorna 404 para escalón inexistente', async () => {
    const res = await request(testApp)
      .delete(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity/999999`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Mínimo de compra ─────────────────────────────────────────────────────────

describe('PATCH /admin/products/:id/min-quantity', () => {
  it('actualiza el mínimo de compra del producto', async () => {
    const res = await request(testApp)
      .patch(`${ADMIN_BASE}/products/${productId}/min-quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ minQuantityPurchase: 50 });
  });

  it('desactiva el mínimo enviando null', async () => {
    await request(testApp)
      .patch(`${ADMIN_BASE}/products/${productId}/min-quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 50 });

    const res = await request(testApp)
      .patch(`${ADMIN_BASE}/products/${productId}/min-quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: null });
    expect(res.status).toBe(200);
    expect(res.body.data.minQuantityPurchase).toBeNull();
  });
});

// ─── Aplicación del descuento en pedidos CANTIDAD ────────────────────────────

describe('Descuento aplicado en pedido CANTIDAD', () => {
  let orderId: number;

  beforeEach(async () => {
    // Re-sembrar admin (afterEach de test anterior truncó users)
    await seedAdmin();
    const loginRes = await request(testApp)
      .post(`${AUTH_BASE}/login`)
      .send({ email: 'admin@jedami.com', password: 'admin123' });
    adminToken = loginRes.body.data?.token;

    // Re-crear wholesale user (truncado por afterEach)
    const ws = await setupWholesaleUser();
    wholesaleToken = ws.token;
  

    // Resetear mínimo de compra
    await pool.query('UPDATE products SET min_quantity_purchase = NULL WHERE id = $1', [productId]);

    // Crear pedido de tipo cantidad
    const orderRes = await request(testApp)
      .post(ORDERS_BASE)
      .set('Authorization', `Bearer ${wholesaleToken}`)
      .send({ purchaseType: 'cantidad' });
    orderId = orderRes.body.data?.id;
  });

  it('retorna 422 cuando la cantidad es menor al mínimo de compra', async () => {
    // Setear mínimo de 50 directamente en DB
    await pool.query('UPDATE products SET min_quantity_purchase = 50 WHERE id = $1', [productId]);

    const res = await request(testApp)
      .post(`${ORDERS_BASE}/${orderId}/items`)
      .set('Authorization', `Bearer ${wholesaleToken}`)
      .send({ productId, quantity: 10 });

    expect(res.status).toBe(422);
    expect(res.body.title ?? res.body.detail ?? '').toMatch(/mínima/i);
  });

  it('aplica descuento correcto cuando la cantidad supera el escalón', async () => {
    // Crear escalón: desde 5 unidades → 20% off
    await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/quantity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minQuantity: 5, discountPct: 20 });

    // Verificar que hay stock suficiente
    const stockRes = await pool.query(
      `SELECT COALESCE(SUM(s.quantity), 0) AS total
       FROM variants v
       JOIN stock s ON s.variant_id = v.id
       WHERE v.product_id = $1 AND v.active = TRUE`,
      [productId],
    );
    const totalStock = Number(stockRes.rows[0].total);
    if (totalStock < 5) return; // skip si no hay stock suficiente en el seed

    const res = await request(testApp)
      .post(`${ORDERS_BASE}/${orderId}/items`)
      .set('Authorization', `Bearer ${wholesaleToken}`)
      .send({ productId, quantity: 5 });

    expect(res.status).toBe(201);
    const item = res.body.data?.items?.[0];
    expect(item).toBeDefined();
    expect(item.discountPct).toBe(20);
    expect(item.originalUnitPrice).not.toBeNull();
    // El unit_price debe ser menor al original
    expect(item.unitPrice).toBeLessThan(item.originalUnitPrice);
  });

  it('no aplica descuento cuando no hay escalones configurados', async () => {
    // Sin escalones configurados (truncados por afterEach)
    const stockRes = await pool.query(
      `SELECT COALESCE(SUM(s.quantity), 0) AS total
       FROM variants v
       JOIN stock s ON s.variant_id = v.id
       WHERE v.product_id = $1 AND v.active = TRUE`,
      [productId],
    );
    const totalStock = Number(stockRes.rows[0].total);
    if (totalStock < 1) return;

    const res = await request(testApp)
      .post(`${ORDERS_BASE}/${orderId}/items`)
      .set('Authorization', `Bearer ${wholesaleToken}`)
      .send({ productId, quantity: 1 });

    expect(res.status).toBe(201);
    const item = res.body.data?.items?.[0];
    expect(item.discountPct).toBe(0);
    expect(item.originalUnitPrice).toBeNull();
  });
});

// ─── Curva rules ──────────────────────────────────────────────────────────────

describe('POST /admin/products/:id/discount-rules/curva', () => {
  it('crea escalón de curva correctamente', async () => {
    const res = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/curva`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minCurves: 10, discountPct: 15 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      product_id: productId,
      min_curves: 10,
    });
    expect(Number(res.body.data.discount_pct)).toBe(15);
  });

  it('retorna 409 al crear escalón de curva duplicado', async () => {
    await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/curva`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minCurves: 10, discountPct: 15 });

    const res = await request(testApp)
      .post(`${ADMIN_BASE}/products/${productId}/discount-rules/curva`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ minCurves: 10, discountPct: 20 });

    expect(res.status).toBe(409);
  });
});
