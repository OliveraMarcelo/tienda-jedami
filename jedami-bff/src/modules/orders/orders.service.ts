import { pool } from '../../config/database.js';
import { AppError } from '../../types/app-error.js';
import { cacheDel } from '../../config/redis.js';
import * as ordersRepository from './orders.repository.js';
import * as customersRepository from '../customers/customers.repository.js';
import * as productsRepository from '../products/products.repository.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantWithStock {
  id: number;
  size: string;
  color: string;
  retail_price: string;
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
    `SELECT v.id, v.size, v.color, v.retail_price, COALESCE(s.quantity, 0) AS stock_quantity
     FROM variants v
     LEFT JOIN stock s ON s.variant_id = v.id
     WHERE v.product_id = $1
     ORDER BY v.id`,
    [productId],
  );
  return result.rows;
}

// ─── Create Retail Order ──────────────────────────────────────────────────────

export async function createRetailOrder(
  userId: number,
  items: { variantId: number; quantity: number }[],
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
    `SELECT v.id, v.retail_price FROM variants v WHERE v.id = ANY($1)`,
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
      `INSERT INTO orders (customer_id, purchase_type, status)
       VALUES ($1, 'retail', 'pending') RETURNING id, customer_id, purchase_type, status, total_amount, created_at`,
      [customer.id],
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

export async function createOrder(userId: number, purchaseType: 'curva' | 'cantidad') {
  if (!purchaseType || !['curva', 'cantidad'].includes(purchaseType)) {
    throw new AppError(400, 'purchaseType requerido', 'https://jedami.com/errors/validation', 'purchaseType es obligatorio para compras mayoristas y debe ser "curva" o "cantidad"');
  }

  const customer = await getCustomerOrFail(userId);
  const order = await ordersRepository.create(customer.id, purchaseType);

  return {
    id: order.id,
    customerId: order.customer_id,
    purchaseType: order.purchase_type,
    status: order.status,
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

  if (order.purchase_type !== 'curva') {
    throw new AppError(400, 'Tipo de pedido incorrecto', 'https://jedami.com/errors/validation', 'Este pedido no es de tipo curva');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Leer variantes dentro de la TX para consistencia
    const variants = await getVariantsWithStockInTx(client, productId);
    if (variants.length === 0) {
      throw new AppError(422, 'Sin variantes', 'https://jedami.com/errors/no-variants', 'El producto no tiene variantes disponibles');
    }

    const insufficient = variants.filter(v => v.stock_quantity < curves);
    if (insufficient.length > 0) {
      const detail = insufficient
        .map(v => `${v.size} ${v.color} (stock disponible: ${v.stock_quantity})`)
        .join(', ');
      throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', `Variantes sin stock suficiente para ${curves} curvas: ${detail}`);
    }

    const items: { id: number; variantId: number; quantity: number; unitPrice: number }[] = [];
    let itemsTotal = 0;

    for (const variant of variants) {
      // Deducción atómica dentro de la TX (previene race condition)
      const stockRes = await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE variant_id = $2 AND quantity >= $1 RETURNING quantity',
        [curves, variant.id],
      );
      if (stockRes.rowCount === 0) {
        throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', `Stock insuficiente para variante ${variant.size} ${variant.color}`);
      }

      const res = await client.query(
        'INSERT INTO order_items (order_id, variant_id, quantity, unit_price) VALUES ($1, $2, $3, $4) RETURNING id, variant_id, quantity, unit_price',
        [orderId, variant.id, curves, variant.retail_price],
      );
      const item = res.rows[0];
      items.push({ id: item.id, variantId: item.variant_id, quantity: item.quantity, unitPrice: Number(item.unit_price) });
      itemsTotal += curves * Number(variant.retail_price);
    }

    const updatedOrderRes = await client.query(
      'UPDATE orders SET total_amount = total_amount + $1 WHERE id = $2 RETURNING total_amount',
      [itemsTotal, orderId],
    );

    await client.query('COMMIT');
    await cacheDel('catalog:*', 'product:*');

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

  if (order.purchase_type !== 'cantidad') {
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
    const deductions: { variantId: number; amount: number; retailPrice: number }[] = [];
    for (const variant of sortedVariants) {
      if (remaining <= 0) break;
      const deduct = Math.min(variant.stock_quantity, remaining);
      if (deduct > 0) {
        deductions.push({ variantId: variant.id, amount: deduct, retailPrice: Number(variant.retail_price) });
        remaining -= deduct;
      }
    }

    // Precio real basado en las deducciones concretas (no promedio ponderado)
    const totalAddition = deductions.reduce((sum, d) => sum + d.amount * d.retailPrice, 0);
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

// ─── Get Orders ───────────────────────────────────────────────────────────────

export async function getMyOrders(userId: number) {
  const customer = await getCustomerOrFail(userId);
  const orders = await ordersRepository.findByCustomerId(customer.id);

  return orders.map(o => ({
    id: o.id,
    purchaseType: o.purchase_type,
    status: o.status,
    totalAmount: Number(o.total_amount),
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
