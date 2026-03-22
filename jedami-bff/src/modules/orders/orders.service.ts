import { pool } from '../../config/database.js';
import { AppError } from '../../types/app-error.js';
import { cacheDel } from '../../config/redis.js';
import * as ordersRepository from './orders.repository.js';
import * as customersRepository from '../customers/customers.repository.js';
import * as productsRepository from '../products/products.repository.js';
import { PRICE_MODES, PURCHASE_TYPES } from '../../lib/constants.js';
import { WholesalePurchaseType } from './orders.entity.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantWithStock {
  id: number;
  size: string;
  color: string;
  retail_price: string;
  wholesale_price: string | null;
  stock_quantity: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCustomerOrFail(userId: number) {
  const customer = await customersRepository.findByUserId(userId);
  if (!customer) {
    throw new AppError(403, 'Sin perfil de comprador', 'https://jedami.com/errors/no-customer', 'El usuario no tiene perfil de comprador');
  }
  return customer;
}

async function getOrderAndVerifyOwnership(orderId: number, customerId: number) {
  const order = await ordersRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/order-not-found', `No existe pedido con id ${orderId}`);
  }
  if (order.customer_id !== customerId) {
    throw new AppError(403, 'Acceso denegado', 'https://jedami.com/errors/forbidden', 'No tienes permiso para acceder a este pedido');
  }
  return order;
}

// Leer variantes dentro de una transacción existente para prevenir race conditions
async function getVariantsWithStockInTx(
  client: import('pg').PoolClient,
  productId: number,
): Promise<VariantWithStock[]> {
  const result = await client.query(
    `SELECT v.id,
            sz.label                AS size,
            cl.name                 AS color,
            pp_r.price              AS retail_price,
            pp_w.price              AS wholesale_price,
            COALESCE(s.quantity, 0) AS stock_quantity
     FROM variants v
     JOIN sizes sz  ON sz.id = v.size_id
     JOIN colors cl ON cl.id = v.color_id
     LEFT JOIN stock s ON s.variant_id = v.id
     LEFT JOIN product_prices pp_r
       ON pp_r.product_id = v.product_id
       AND pp_r.price_mode_id = (SELECT id FROM price_modes WHERE code = '${PRICE_MODES.RETAIL}')
     LEFT JOIN product_prices pp_w
       ON pp_w.product_id = v.product_id
       AND pp_w.price_mode_id = (SELECT id FROM price_modes WHERE code = '${PRICE_MODES.WHOLESALE}')
     WHERE v.product_id = $1
       AND v.active = TRUE
       AND sz.active = TRUE
       AND cl.active = TRUE
     ORDER BY v.id`,
    [productId],
  );
  return result.rows;
}

// ─── Create Retail Order ──────────────────────────────────────────────────────

export async function createRetailOrder(
  userId: number,
  items: { variantId: number; quantity: number }[],
  notes?: string | null,
) {
  if (!items || items.length === 0) {
    throw new AppError(400, 'Items requeridos', 'https://jedami.com/errors/validation', 'Debe enviar al menos un ítem');
  }

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError(400, 'Cantidad inválida', 'https://jedami.com/errors/validation', `La cantidad de cada ítem debe ser un entero positivo (variantId: ${item.variantId})`);
    }
  }

  const customer = await getCustomerOrFail(userId);
  const variantIds = items.map(i => i.variantId);

  // Fetch prices outside TX (read-only, prices don't change concurrently)
  const priceRes = await pool.query(
    `SELECT v.id, pp.price AS retail_price
     FROM variants v
     JOIN product_prices pp ON pp.product_id = v.product_id
     JOIN price_modes pm ON pm.id = pp.price_mode_id AND pm.code = '${PRICE_MODES.RETAIL}'
     WHERE v.id = ANY($1)`,
    [variantIds],
  );
  const priceMap = new Map<number, number>(
    priceRes.rows.map((r: { id: number; retail_price: string }) => [r.id, Number(r.retail_price)]),
  );

  for (const item of items) {
    if (!priceMap.has(item.variantId)) {
      throw new AppError(404, 'Variante no encontrada', 'https://jedami.com/errors/not-found', `No existe variante con id ${item.variantId}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, purchase_type, status, notes)
       VALUES ($1, '${PURCHASE_TYPES.RETAIL}', 'pending', $2) RETURNING id, customer_id, purchase_type, status, total_amount, notes, created_at`,
      [customer.id, notes ?? null],
    );
    const order = orderRes.rows[0];

    let totalAmount = 0;
    const insertedItems: { id: number; variantId: number; quantity: number; unitPrice: number }[] = [];

    for (const item of items) {
      const retailPrice = priceMap.get(item.variantId)!;

      // Deducción atómica: falla si stock insuficiente (previene race condition)
      const stockRes = await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE variant_id = $2 AND quantity >= $1 RETURNING quantity',
        [item.quantity, item.variantId],
      );
      if (stockRes.rowCount === 0) {
        throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', `Stock insuficiente para variante ${item.variantId}`);
      }

      const itemRes = await client.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4) RETURNING id, variant_id, quantity, unit_price`,
        [order.id, item.variantId, item.quantity, retailPrice],
      );
      const inserted = itemRes.rows[0];
      insertedItems.push({
        id: inserted.id,
        variantId: inserted.variant_id,
        quantity: inserted.quantity,
        unitPrice: Number(inserted.unit_price),
      });
      totalAmount += item.quantity * retailPrice;
    }

    await client.query(
      'UPDATE orders SET total_amount = $1 WHERE id = $2',
      [totalAmount, order.id],
    );

    await client.query('COMMIT');
    await cacheDel('catalog:*', 'product:*');

    return {
      id: order.id,
      customerId: order.customer_id,
      purchaseType: order.purchase_type,
      status: order.status,
      totalAmount,
      notes: order.notes ?? null,
      createdAt: order.created_at,
      items: insertedItems,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Create Order ─────────────────────────────────────────────────────────────

export async function createOrder(userId: number, purchaseType: WholesalePurchaseType, notes?: string | null) {
  if (!purchaseType || ![PURCHASE_TYPES.CURVA, PURCHASE_TYPES.CANTIDAD].includes(purchaseType)) {
    throw new AppError(400, 'purchaseType requerido', 'https://jedami.com/errors/validation', 'purchaseType es obligatorio para compras mayoristas y debe ser "curva" o "cantidad"');
  }

  const customer = await getCustomerOrFail(userId);
  const order = await ordersRepository.create(customer.id, purchaseType, notes);

  return {
    id: order.id,
    customerId: order.customer_id,
    purchaseType: order.purchase_type,
    status: order.status,
    notes: order.notes ?? null,
    createdAt: order.created_at,
  };
}

// ─── Add Items — Curva ────────────────────────────────────────────────────────

export async function addCurvaItems(orderId: number, productId: number, curves: number, userId: number) {
  if (!curves || curves <= 0 || !Number.isInteger(curves)) {
    throw new AppError(400, 'Curvas inválidas', 'https://jedami.com/errors/validation', 'curves debe ser un entero positivo');
  }

  const customer = await getCustomerOrFail(userId);
  const order = await getOrderAndVerifyOwnership(orderId, customer.id);

  if (order.purchase_type !== PURCHASE_TYPES.CURVA) {
    throw new AppError(400, 'Tipo de pedido incorrecto', 'https://jedami.com/errors/validation', 'Este pedido no es de tipo curva');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener talles únicos activos del producto con su precio mayorista
    const sizesRes = await client.query(
      `SELECT DISTINCT ON (v.size_id)
         v.size_id,
         sz.label AS size_label,
         pp_w.price AS wholesale_price,
         pp_r.price AS retail_price
       FROM variants v
       JOIN sizes sz ON sz.id = v.size_id AND sz.active = TRUE
       LEFT JOIN product_prices pp_w
         ON pp_w.product_id = v.product_id
         AND pp_w.price_mode_id = (SELECT id FROM price_modes WHERE code = '${PRICE_MODES.WHOLESALE}')
       LEFT JOIN product_prices pp_r
         ON pp_r.product_id = v.product_id
         AND pp_r.price_mode_id = (SELECT id FROM price_modes WHERE code = '${PRICE_MODES.RETAIL}')
       WHERE v.product_id = $1
         AND v.active = TRUE
       ORDER BY v.size_id, sz.sort_order`,
      [productId],
    );

    if (sizesRes.rows.length === 0) {
      throw new AppError(422, 'Sin talles', 'https://jedami.com/errors/no-variants', 'El producto no tiene talles disponibles');
    }

    const items: { id: number; sizeId: number; size: string; quantity: number; unitPrice: number }[] = [];
    let itemsTotal = 0;

    // 1 ítem por talle — sin variante asignada, sin deducción de stock.
    // El admin asigna el color y deduce stock al despachar el pedido pagado.
    for (const size of sizesRes.rows) {
      const unitPrice = size.wholesale_price != null ? Number(size.wholesale_price) : Number(size.retail_price);
      const res = await client.query(
        'INSERT INTO order_items (order_id, product_id, size_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5) RETURNING id, size_id, quantity, unit_price',
        [orderId, productId, size.size_id, curves, unitPrice],
      );
      const item = res.rows[0];
      items.push({ id: item.id, sizeId: item.size_id, size: size.size_label, quantity: item.quantity, unitPrice: Number(item.unit_price) });
      itemsTotal += curves * unitPrice;
    }

    const updatedOrderRes = await client.query(
      'UPDATE orders SET total_amount = total_amount + $1 WHERE id = $2 RETURNING total_amount',
      [itemsTotal, orderId],
    );

    await client.query('COMMIT');

    return {
      orderId,
      items,
      totalAmount: Number(updatedOrderRes.rows[0].total_amount),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Add Items — Cantidad ─────────────────────────────────────────────────────

export async function addCantidadItems(orderId: number, productId: number, quantity: number, userId: number) {
  if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new AppError(400, 'Cantidad inválida', 'https://jedami.com/errors/validation', 'quantity debe ser un entero positivo');
  }

  const customer = await getCustomerOrFail(userId);
  const order = await getOrderAndVerifyOwnership(orderId, customer.id);

  if (order.purchase_type !== PURCHASE_TYPES.CANTIDAD) {
    throw new AppError(400, 'Tipo de pedido incorrecto', 'https://jedami.com/errors/validation', 'Este pedido no es de tipo cantidad');
  }

  const product = await productsRepository.findById(productId);
  if (!product) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${productId}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Leer variantes dentro de la TX para consistencia
    const variants = await getVariantsWithStockInTx(client, productId);
    const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);

    if (totalStock < quantity) {
      const detail = variants.map(v => `${v.size} ${v.color}: ${v.stock_quantity}`).join(', ');
      throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', `Stock total disponible: ${totalStock}. Detalle por variante: ${detail}`);
    }

    // Greedy: deducir del variant con más stock primero
    const sortedVariants = [...variants].sort((a, b) => b.stock_quantity - a.stock_quantity);
    let remaining = quantity;
    const deductions: { variantId: number; amount: number; unitPrice: number }[] = [];
    for (const variant of sortedVariants) {
      if (remaining <= 0) break;
      const deduct = Math.min(variant.stock_quantity, remaining);
      if (deduct > 0) {
        // Usar precio mayorista si está disponible; caer en minorista como fallback
        const unitPrice = variant.wholesale_price != null ? Number(variant.wholesale_price) : Number(variant.retail_price);
        deductions.push({ variantId: variant.id, amount: deduct, unitPrice });
        remaining -= deduct;
      }
    }

    // Precio real basado en las deducciones concretas (no promedio ponderado)
    const totalAddition = deductions.reduce((sum, d) => sum + d.amount * d.unitPrice, 0);
    const unitPrice = quantity > 0 ? totalAddition / quantity : 0;

    const res = await client.query(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4) RETURNING id, product_id, quantity, unit_price',
      [orderId, productId, quantity, unitPrice],
    );
    const item = res.rows[0];

    for (const d of deductions) {
      // Deducción atómica dentro de la TX (previene race condition)
      const stockRes = await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE variant_id = $2 AND quantity >= $1 RETURNING quantity',
        [d.amount, d.variantId],
      );
      if (stockRes.rowCount === 0) {
        throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', `Stock insuficiente para variante ${d.variantId} durante el procesamiento`);
      }
    }


    const updatedOrderRes = await client.query(
      'UPDATE orders SET total_amount = total_amount + $1 WHERE id = $2 RETURNING total_amount',
      [totalAddition, orderId],
    );

    await client.query('COMMIT');
    await cacheDel('catalog:*', 'product:*');

    return {
      orderId,
      items: [{
        id: item.id,
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
      }],
      totalAmount: Number(updatedOrderRes.rows[0].total_amount),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Add Items — dispatcher ───────────────────────────────────────────────────

export async function addItems(
  orderId: number,
  body: { productId?: number; curves?: number; quantity?: number },
  userId: number,
) {
  const { productId, curves, quantity } = body;

  if (!productId) {
    throw new AppError(400, 'productId requerido', 'https://jedami.com/errors/validation', 'productId es obligatorio');
  }

  if (curves != null) {
    return addCurvaItems(orderId, productId, curves, userId);
  } else if (quantity != null) {
    return addCantidadItems(orderId, productId, quantity, userId);
  } else {
    throw new AppError(400, 'Parámetros inválidos', 'https://jedami.com/errors/validation', 'Debe especificar "curves" (para compra por curva) o "quantity" (para compra por cantidad)');
  }
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────

export async function cancelOrder(orderId: number, userId: number, isAdmin: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderRes.rows[0];
    if (!order) {
      throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/order-not-found', `No existe pedido con id ${orderId}`);
    }

    if (!isAdmin) {
      const customer = await customersRepository.findByUserId(userId);
      if (!customer || order.customer_id !== customer.id) {
        throw new AppError(403, 'Acceso denegado', 'https://jedami.com/errors/forbidden', 'No tenés permiso para cancelar este pedido');
      }
    }

    if (order.status !== 'pending') {
      throw new AppError(422, 'Estado inválido', 'https://jedami.com/errors/invalid-status', 'Solo se pueden cancelar pedidos en estado pending');
    }

    // Restaurar stock de ítems que tienen variant_id
    const itemsRes = await client.query(
      'SELECT variant_id, quantity FROM order_items WHERE order_id = $1 AND variant_id IS NOT NULL',
      [orderId],
    );
    for (const item of itemsRes.rows) {
      await client.query(
        'UPDATE stock SET quantity = quantity + $1 WHERE variant_id = $2',
        [item.quantity, item.variant_id],
      );
    }

    await client.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = $1",
      [orderId],
    );

    await client.query('COMMIT');
    return { id: orderId, status: 'cancelled' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Update Notes ─────────────────────────────────────────────────────────────

export async function updateOrderNotes(orderId: number, userId: number, notes: string | null) {
  const customer = await getCustomerOrFail(userId);
  const order = await getOrderAndVerifyOwnership(orderId, customer.id);

  if (order.status !== 'pending') {
    throw new AppError(422, 'Estado inválido', 'https://jedami.com/errors/invalid-status', 'Solo se pueden editar las notas de pedidos en estado pending');
  }

  await pool.query('UPDATE orders SET notes = $1 WHERE id = $2', [notes ?? null, orderId]);
  return { id: orderId, notes: notes ?? null };
}

// ─── Get Orders ───────────────────────────────────────────────────────────────

export async function getMyOrders(userId: number) {
  const customer = await getCustomerOrFail(userId);
  const orders = await ordersRepository.findByCustomerId(customer.id);

  return orders.map(o => ({
    id: o.id,
    purchaseType: o.purchase_type,
    status: o.status,
    totalAmount: Number(o.total_amount),
    notes: o.notes ?? null,
    createdAt: o.created_at,
  }));
}

export async function getOrderById(orderId: number, userId: number) {
  const customer = await getCustomerOrFail(userId);
  const order = await getOrderAndVerifyOwnership(orderId, customer.id);
  const items = await ordersRepository.findItemsByOrderId(orderId);

  return {
    id: order.id,
    purchaseType: order.purchase_type,
    status: order.status,
    totalAmount: Number(order.total_amount),
    notes: order.notes ?? null,
    createdAt: order.created_at,
    items: items.map(i => ({
      id: i.id,
      variantId: i.variant_id ?? null,
      productId: i.product_id ?? null,
      size: i.variant_size ?? null,
      color: i.variant_color ?? null,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
    })),
  };
}
