import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';
import { testApp } from './helpers/app.js';
import { shortage, variantAvailable, type ProductStock } from '../modules/products/availability.js';

// Reserva de stock: las compras por curva y por cantidad pagadas (y sin despachar) dejan sus unidades
// reservadas por talle, y la tienda no las vuelve a vender.

const API = '/api/v1';

let productId: number;
let sizeA: { id: number; label: string };
let sizeB: { id: number; label: string };
let variantA: number;
let variantB: number;

async function user(email: string, wholesale: boolean): Promise<string> {
  await request(testApp).post(`${API}/auth/register`).send({ email, password: 'Password123!' });
  if (wholesale) {
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT u.id, r.id FROM users u, roles r WHERE u.email = $1 AND r.name = 'wholesale' ON CONFLICT DO NOTHING`,
      [email],
    );
    await pool.query("UPDATE customers SET customer_type = 'wholesale' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [email]);
  }
  const login = await request(testApp).post(`${API}/auth/login`).send({ email, password: 'Password123!' });
  return login.body.data.token;
}

/** Pedido por curva de `curves` curvas (una prenda por talle por curva) */
async function curvaOrder(token: string, curves: number): Promise<number> {
  const o = await request(testApp).post(`${API}/orders`).set('Authorization', `Bearer ${token}`).send({ purchaseType: 'curva' });
  const id = o.body.data.id;
  const r = await request(testApp).post(`${API}/orders/${id}/items`).set('Authorization', `Bearer ${token}`).send({ productId, curves });
  expect(r.status).toBe(201);
  return id;
}

async function variantStock(variantId: number): Promise<number> {
  const res = await request(testApp).get(`${API}/products/${productId}`);
  return res.body.data.variants.find((v: { id: number }) => v.id === variantId).stock.quantity;
}

beforeAll(async () => {
  const sizes = (await pool.query('SELECT id, label FROM sizes WHERE active = TRUE ORDER BY sort_order, id LIMIT 2')).rows;
  [sizeA, sizeB] = sizes;
  const colorId = (await pool.query('SELECT id FROM colors WHERE active = TRUE ORDER BY id LIMIT 1')).rows[0].id;
  productId = (await pool.query("INSERT INTO products (name) VALUES ('Prueba reserva de stock') RETURNING id")).rows[0].id;
  await pool.query(
    `INSERT INTO product_prices (product_id, price_mode_id, price)
     SELECT $1, id, CASE code WHEN 'retail' THEN 1000 ELSE 800 END FROM price_modes WHERE code IN ('retail', 'wholesale')`,
    [productId],
  );
  variantA = (await pool.query('INSERT INTO variants (product_id, size_id, color_id) VALUES ($1, $2, $3) RETURNING id', [productId, sizeA.id, colorId])).rows[0].id;
  variantB = (await pool.query('INSERT INTO variants (product_id, size_id, color_id) VALUES ($1, $2, $3) RETURNING id', [productId, sizeB.id, colorId])).rows[0].id;
});

beforeEach(async () => {
  // Talle A: 3, talle B: 2
  await pool.query(
    `INSERT INTO stock (variant_id, quantity) VALUES ($1, 3), ($2, 2)
     ON CONFLICT (variant_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
    [variantA, variantB],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM order_items WHERE product_id = $1 OR variant_id IN ($2, $3)', [productId, variantA, variantB]);
  await pool.query('DELETE FROM stock WHERE variant_id IN ($1, $2)', [variantA, variantB]);
  await pool.query('DELETE FROM variants WHERE product_id = $1', [productId]);
  await pool.query('DELETE FROM product_prices WHERE product_id = $1', [productId]);
  await pool.query('DELETE FROM products WHERE id = $1', [productId]);
});

describe('Reserva de stock por pedidos pagados', () => {
  it('un pedido por curva sin pagar no reserva nada', async () => {
    const ws = await user('reserva-ws1@test.com', true);
    await curvaOrder(ws, 2);
    expect(await variantStock(variantA)).toBe(3);
    expect(await variantStock(variantB)).toBe(2);
  });

  it('pagado: la tienda muestra solo lo disponible y el admin ve el físico y lo reservado', async () => {
    const ws = await user('reserva-ws2@test.com', true);
    const id = await curvaOrder(ws, 2); // reserva 2 del talle A y 2 del B
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [id]);

    expect(await variantStock(variantA)).toBe(1);
    expect(await variantStock(variantB)).toBe(0);

    await pool.query(
      "INSERT INTO users(email, password_hash) VALUES ('admin@jedami.com', '$2b$10$Zjjg2LIvda6dlOFp9ZO4YeOHg8ampzT3y7.526gm2pzBZxzZ.wFIm') ON CONFLICT (email) DO NOTHING",
    );
    await pool.query(
      `INSERT INTO user_roles(user_id, role_id) SELECT u.id, r.id FROM users u, roles r
       WHERE u.email = 'admin@jedami.com' AND r.name = 'admin' ON CONFLICT DO NOTHING`,
    );
    const admin = (await request(testApp).post(`${API}/auth/login`).send({ email: 'admin@jedami.com', password: 'admin123' })).body.data.token;
    const list = await request(testApp).get(`${API}/products?includeInactive=true&pageSize=100`).set('Authorization', `Bearer ${admin}`);
    const p = list.body.data.find((x: { id: number }) => x.id === productId);
    expect(p.reserved).toBe(4);
    expect(p.variants.find((v: { id: number }) => v.id === variantA).stock.quantity).toBe(3);
  });

  it('una compra minorista no puede llevarse unidades reservadas', async () => {
    const ws = await user('reserva-ws3@test.com', true);
    const id = await curvaOrder(ws, 2);
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [id]);
    const retail = await user('reserva-retail@test.com', false);
    const buy = (variantId: number, quantity: number) =>
      request(testApp).post(`${API}/orders`).set('Authorization', `Bearer ${retail}`).send({ items: [{ variantId, quantity }] });

    expect((await buy(variantB, 1)).status).toBe(422); // hay 2 y las 2 están reservadas
    expect((await buy(variantA, 2)).status).toBe(422); // hay 3, 2 reservadas: queda 1
    expect((await buy(variantA, 1)).status).toBe(201);
    // El intento fallido no descontó nada
    const stock = (await pool.query('SELECT variant_id, quantity FROM stock WHERE variant_id IN ($1, $2) ORDER BY variant_id', [variantA, variantB])).rows;
    expect(stock.map(r => r.quantity)).toEqual([2, 2]);
  });

  it('otro mayorista no puede pedir lo que ya está reservado (curva y cantidad)', async () => {
    const ws = await user('reserva-ws4@test.com', true);
    const paid = await curvaOrder(ws, 2);
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [paid]);

    const o = await request(testApp).post(`${API}/orders`).set('Authorization', `Bearer ${ws}`).send({ purchaseType: 'curva' });
    const r = await request(testApp).post(`${API}/orders/${o.body.data.id}/items`).set('Authorization', `Bearer ${ws}`).send({ productId, curves: 1 });
    expect(r.status).toBe(422);
    expect(r.body.detail).toContain(`talle ${sizeB.label}`);

    const c = await request(testApp).post(`${API}/orders`).set('Authorization', `Bearer ${ws}`).send({ purchaseType: 'cantidad' });
    const q = await request(testApp).post(`${API}/orders/${c.body.data.id}/items`).set('Authorization', `Bearer ${ws}`).send({ productId, quantity: 2 });
    expect(q.status).toBe(422); // 1 por talle, pero del B no queda nada libre
  });

  it('al pagar se vuelve a controlar: si otro pedido pagado se llevó el stock, no deja pagar', async () => {
    const ws = await user('reserva-ws5@test.com', true);
    const first = await curvaOrder(ws, 2);  // todavía no pagado: pasa el control
    const second = await curvaOrder(ws, 2);
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [second]);

    const res = await request(testApp).post(`${API}/payments/checkout`).set('Authorization', `Bearer ${ws}`).send({ orderId: first });
    expect(res.status).toBe(422);
    expect(res.body.title).toBe('Stock insuficiente');
  });

  it('despachado (o cancelado) deja de reservar', async () => {
    const ws = await user('reserva-ws6@test.com', true);
    const id = await curvaOrder(ws, 2);
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [id]);
    expect(await variantStock(variantB)).toBe(0);
    await pool.query("UPDATE orders SET status = 'shipped' WHERE id = $1", [id]);
    expect(await variantStock(variantB)).toBe(2);
  });
});

describe('Cálculo de disponibilidad', () => {
  const p: ProductStock = {
    stockBySize: new Map([[1, 10], [2, 4]]),
    reservedBySize: new Map([[1, 6]]),
    total: 14,
    reservedTotal: 9, // 6 del talle 1 + 3 sin talle
  };

  it('una variante no puede ofrecer más que lo libre de su talle ni del producto', () => {
    expect(variantAvailable(p, 1, 10)).toBe(4);  // talle 1: 10 − 6
    expect(variantAvailable(p, 2, 4)).toBe(4);
    expect(variantAvailable({ ...p, reservedTotal: 12 }, 2, 4)).toBe(2); // producto: 14 − 12
    expect(variantAvailable(undefined, 1, 7)).toBe(7);
  });

  it('nunca da negativo aunque lo reservado supere al stock', () => {
    expect(variantAvailable({ ...p, reservedBySize: new Map([[1, 20]]) }, 1, 10)).toBe(0);
  });

  it('shortage indica el primer faltante', () => {
    expect(shortage(p, new Map([[1, 4]]))).toBeNull();
    expect(shortage(p, new Map([[1, 5]]), 0, () => 'M')).toContain('talle M quedan 4 unidades disponibles');
    expect(shortage(p, new Map([[1, 4], [2, 1]]), 0)).toBeNull(); // 5 libres del producto, pide 5
    expect(shortage(p, new Map([[1, 4], [2, 2]]), 0)).toContain('De este producto quedan 5 unidades disponibles y necesitás 6');
  });
});
