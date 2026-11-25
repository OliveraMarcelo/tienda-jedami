// Despacho de pedidos pagados.
// En curva y cantidad el cliente no elige color. El admin puede repartir las unidades en una grilla talle × color
// para que se descuente el stock de cada variante; es recomendable pero no obligatorio. Lo que no reparte no
// descuenta stock (lo ajusta él en Productos). Al despachar, el pedido deja de reservar sus unidades.
import { Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { cacheDel } from '../../config/redis.js';
import { AppError } from '../../types/app-error.js';
import { PAID_ORDERS_QUERY, ORDER_LINES_QUERY, PRODUCT_VARIANTS_QUERY } from './queries/fulfillment.js';

type LineRow = {
  id: number; order_id: number; product_id: number; product_name: string;
  size_id: number | null; size_label: string | null; size_order: number | null;
  variant_id: number | null; quantity: number; stock_deducted: boolean;
};
type VariantRow = {
  id: number; product_id: number; size_id: number; size_label: string; size_order: number;
  color_id: number; color_name: string; color_hex: string | null; stock: number;
};

type Size = { id: number; label: string; order: number };

// ─── GET /admin/orders/pending-fulfillment ────────────────────────────────────

export async function getPendingFulfillment(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orders = (await pool.query(PAID_ORDERS_QUERY)).rows;
    if (orders.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const lines: LineRow[] = (await pool.query(ORDER_LINES_QUERY, [orders.map(o => o.id)])).rows;
    const productIds = [...new Set(lines.map(l => l.product_id))];
    const chosenVariantIds = lines.filter(l => l.variant_id).map(l => l.variant_id as number);
    const variants: VariantRow[] = (await pool.query(PRODUCT_VARIANTS_QUERY, [productIds, chosenVariantIds])).rows;

    // Grilla de cada producto: talles (filas), colores (columnas) y la variante de cada cruce
    const grids = new Map<number, {
      sizes: Size[];
      colors: { id: number; name: string; hexCode: string | null }[];
      variants: { id: number; sizeId: number; colorId: number; stock: number }[];
    }>();
    for (const v of variants) {
      let g = grids.get(v.product_id);
      if (!g) { g = { sizes: [], colors: [], variants: [] }; grids.set(v.product_id, g); }
      if (!g.sizes.some(s => s.id === v.size_id)) g.sizes.push({ id: v.size_id, label: v.size_label, order: v.size_order });
      if (!g.colors.some(c => c.id === v.color_id)) g.colors.push({ id: v.color_id, name: v.color_name, hexCode: v.color_hex });
      g.variants.push({ id: v.id, sizeId: v.size_id, colorId: v.color_id, stock: Number(v.stock) });
    }

    const data = orders.map(o => {
      const products = new Map<number, {
        productId: number; productName: string;
        sizes: Size[]; colors: { id: number; name: string; hexCode: string | null }[];
        variants: { id: number; sizeId: number; colorId: number; stock: number }[];
        lines: { id: number; sizeId: number | null; size: string | null; quantity: number; variantId: number | null }[];
      }>();
      for (const l of lines.filter(x => x.order_id === o.id)) {
        let p = products.get(l.product_id);
        if (!p) {
          const g = grids.get(l.product_id) ?? { sizes: [], colors: [], variants: [] };
          p = { productId: l.product_id, productName: l.product_name, sizes: [...g.sizes], colors: g.colors, variants: g.variants, lines: [] };
          products.set(l.product_id, p);
        }
        // Un talle pedido que ya no tiene variantes activas igual se muestra (como fila sin colores)
        if (l.size_id && !p.sizes.some(s => s.id === l.size_id)) {
          p.sizes.push({ id: l.size_id, label: l.size_label ?? '?', order: l.size_order ?? 0 });
        }
        p.lines.push({ id: l.id, sizeId: l.size_id, size: l.size_label, quantity: l.quantity, variantId: l.variant_id });
      }
      return {
        id: o.id,
        createdAt: o.created_at,
        totalAmount: Number(o.total_amount),
        customerEmail: o.customer_email,
        notes: o.notes ?? null,
        purchaseType: o.purchase_type,
        products: [...products.values()].map(p => ({
          ...p,
          sizes: p.sizes.sort((a, b) => a.order - b.order).map(({ id, label }) => ({ id, label })),
        })),
      };
    });

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

// ─── POST /admin/orders/:id/dispatch ──────────────────────────────────────────
// Body: { allocations?: [{ itemId, variantId, quantity }] } — opcional para las líneas sin color (curva/cantidad):
// vacío o parcial se acepta, y solo se descuenta lo repartido. Las líneas minoristas ya tienen variante y no llevan reparto.

type Allocation = { itemId: number; variantId: number; quantity: number };

function parseAllocations(raw: unknown): Allocation[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw invalid('allocations debe ser una lista');
  return raw.map((a) => {
    const itemId = Number(a?.itemId), variantId = Number(a?.variantId), quantity = Number(a?.quantity);
    if (![itemId, variantId, quantity].every(n => Number.isInteger(n) && n > 0)) {
      throw invalid('Cada reparto necesita itemId, variantId y quantity enteros positivos');
    }
    return { itemId, variantId, quantity };
  });
}

function invalid(detail: string) {
  return new AppError(422, 'Reparto inválido', 'https://jedami.com/errors/invalid-allocation', detail);
}

async function deductStock(client: PoolClient, variantId: number, quantity: number) {
  const r = await client.query(
    'UPDATE stock SET quantity = quantity - $1 WHERE variant_id = $2 AND quantity >= $1 RETURNING quantity',
    [quantity, variantId],
  );
  if (r.rowCount === 0) {
    const info = await client.query(
      `SELECT p.name, sz.label AS size, cl.name AS color, COALESCE(s.quantity, 0) AS stock
       FROM variants v JOIN products p ON p.id = v.product_id JOIN sizes sz ON sz.id = v.size_id
       JOIN colors cl ON cl.id = v.color_id LEFT JOIN stock s ON s.variant_id = v.id WHERE v.id = $1`,
      [variantId],
    );
    const i = info.rows[0];
    throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock',
      i ? `${i.name}, talle ${i.size} ${i.color}: pediste ${quantity} y hay ${i.stock}` : 'No hay stock suficiente');
  }
}

export async function dispatchOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orderId = parseInt(req.params.id as string, 10);
  if (isNaN(orderId) || orderId <= 0) {
    next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
    return;
  }

  const client = await pool.connect();
  try {
    const allocations = parseAllocations(req.body?.allocations);
    await client.query('BEGIN');

    const order = (await client.query('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
    if (!order) throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/not-found', `No existe pedido con id ${orderId}`);
    if (order.status !== 'paid') {
      throw new AppError(422, 'Estado inválido', 'https://jedami.com/errors/invalid-status', 'Solo se pueden despachar pedidos pagados');
    }

    const items: { id: number; product_id: number | null; size_id: number | null; variant_id: number | null; quantity: number; stock_deducted: boolean; size_label: string | null }[] = (await client.query(
      `SELECT oi.id, oi.product_id, oi.size_id, oi.variant_id, oi.quantity, oi.stock_deducted, sz.label AS size_label
       FROM order_items oi LEFT JOIN sizes sz ON sz.id = oi.size_id WHERE oi.order_id = $1`,
      [orderId],
    )).rows;

    // Validar el reparto contra las líneas del pedido
    const byItem = new Map<number, Allocation[]>();
    for (const a of allocations) {
      const item = items.find(i => i.id === a.itemId);
      if (!item) throw invalid(`La línea ${a.itemId} no es de este pedido`);
      if (item.variant_id) throw invalid('Las líneas minoristas ya tienen color; no llevan reparto');
      byItem.set(a.itemId, [...(byItem.get(a.itemId) ?? []), a]);
    }

    const variantIds = [...new Set(allocations.map(a => a.variantId))];
    const variantRows: { id: number; product_id: number; size_id: number }[] = variantIds.length
      ? (await client.query('SELECT id, product_id, size_id FROM variants WHERE id = ANY($1)', [variantIds])).rows
      : [];

    for (const item of items.filter(i => !i.variant_id)) {
      const parts = byItem.get(item.id) ?? [];
      const total = parts.reduce((s, a) => s + a.quantity, 0);
      const what = item.size_label ? `el talle ${item.size_label}` : 'el producto';
      if (total > item.quantity) throw invalid(`Para ${what} repartiste ${total} y el pedido tiene ${item.quantity} unidades`);
      if (new Set(parts.map(a => a.variantId)).size !== parts.length) throw invalid('Hay un color repetido en el reparto');
      for (const a of parts) {
        const v = variantRows.find(x => x.id === a.variantId);
        if (!v || v.product_id !== item.product_id) throw invalid('Elegiste una variante de otro producto');
        if (item.size_id && v.size_id !== item.size_id) throw invalid(`En ${what} elegiste un color de otro talle`);
      }
    }

    // Descontar stock (una sola vez por línea) y guardar el reparto.
    // stock_deducted queda en TRUE solo en las líneas que descontaron algo: las que el admin no repartió
    // siguen sin descontar (y al pasar a 'shipped' dejan de reservar igual).
    let stockChanged = false;
    const deducted: number[] = [];
    for (const item of items) {
      const parts = byItem.get(item.id) ?? [];
      if (!item.stock_deducted && (item.variant_id || parts.length > 0)) {
        if (item.variant_id) await deductStock(client, item.variant_id, item.quantity);
        for (const a of parts) await deductStock(client, a.variantId, a.quantity);
        deducted.push(item.id);
        stockChanged = true;
      }
      for (const a of parts) {
        await client.query(
          'INSERT INTO order_item_allocations (order_item_id, variant_id, quantity) VALUES ($1, $2, $3)',
          [a.itemId, a.variantId, a.quantity],
        );
      }
    }
    if (deducted.length) await client.query('UPDATE order_items SET stock_deducted = TRUE WHERE id = ANY($1)', [deducted]);

    const shipped = await client.query(
      `UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = $1 RETURNING shipped_at`,
      [orderId],
    );
    await client.query('COMMIT');
    if (stockChanged) await cacheDel('catalog:*', 'product:*');

    res.status(200).json({ data: { orderId, status: 'shipped', shippedAt: shipped.rows[0].shipped_at } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}
