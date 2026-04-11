import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { AppError } from '../../types/app-error.js';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { DASHBOARD_QUERY, RECENT_ORDERS_QUERY } from './queries/dashboard.js';
import { ADMIN_PAYMENTS_QUERY, ADMIN_PAYMENTS_COUNT_QUERY } from './queries/payments.js';
import { ADMIN_USERS_QUERY, ADMIN_USERS_COUNT_QUERY } from './queries/users.js';
import { PENDING_FULFILLMENT_QUERY } from './queries/pending-fulfillment.js';

const DASHBOARD_CACHE_KEY = 'admin:dashboard';
const DASHBOARD_TTL = 60; // segundos

// ─── Pending fulfillment ──────────────────────────────────────────────────────

export async function getPendingFulfillment(_req: Request, res: Response): Promise<void> {
  const result = await pool.query(PENDING_FULFILLMENT_QUERY);

  const ordersMap = new Map<number, {
    id: number; createdAt: string; totalAmount: number; customerEmail: string;
    notes: string | null; purchaseType: string;
    items: Map<number, {
      id: number; sizeId: number; size: string; quantity: number; unitPrice: number;
      productId: number; productName: string;
      variantAssigned: boolean;
      assignedVariantId: number | null; assignedColor: string | null; assignedHex: string | null;
      availableVariants: { id: number; color: string; hexCode: string | null; stock: number }[];
    }>;
  }>();

  for (const r of result.rows) {
    if (!ordersMap.has(r.order_id)) {
      ordersMap.set(r.order_id, {
        id: r.order_id, createdAt: r.order_created_at,
        totalAmount: Number(r.order_total), customerEmail: r.customer_email,
        notes: r.order_notes ?? null, purchaseType: r.purchase_type,
        items: new Map(),
      });
    }
    const order = ordersMap.get(r.order_id)!;

    if (!order.items.has(r.item_id)) {
      order.items.set(r.item_id, {
        id: r.item_id, sizeId: r.size_id, size: r.size_label,
        quantity: r.quantity, unitPrice: Number(r.unit_price),
        productId: r.product_id, productName: r.product_name,
        variantAssigned: r.variant_assigned,
        assignedVariantId: r.assigned_variant_id ?? null,
        assignedColor: r.assigned_color ?? null,
        assignedHex: r.assigned_hex ?? null,
        availableVariants: [],
      });
    }
    const item = order.items.get(r.item_id)!;

    // Solo agregar variantes disponibles para ítems sin variante asignada
    if (!r.variant_assigned && r.variant_id) {
      const alreadyAdded = item.availableVariants.some(v => v.id === r.variant_id);
      if (!alreadyAdded) {
        item.availableVariants.push({
          id: r.variant_id, color: r.color_name, hexCode: r.color_hex,
          stock: Number(r.stock_quantity ?? 0),
        });
      }
    }
  }

  const data = [...ordersMap.values()].map(o => ({
    ...o,
    items: [...o.items.values()],
  }));

  res.status(200).json({ data });
}

// ─── Fulfill curva order item ─────────────────────────────────────────────────
// El admin asigna la variante (color) a un ítem de pedido curva y descuenta stock.

export async function fulfillOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orderId = parseInt(req.params.orderId, 10);
  const itemId  = parseInt(req.params.itemId, 10);
  const { variantId, decrementStock = false } = req.body;

  if (isNaN(orderId) || isNaN(itemId) || !variantId) {
    next(new AppError(400, 'Datos inválidos', 'https://jedami.com/errors/validation', 'orderId, itemId y variantId son requeridos'));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el pedido existe y está en paid o shipped
    const orderRes = await client.query('SELECT id, status FROM orders WHERE id = $1', [orderId]);
    const order = orderRes.rows[0];
    if (!order) {
      throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/not-found', `No existe pedido con id ${orderId}`);
    }
    if (!['paid', 'shipped'].includes(order.status)) {
      throw new AppError(422, 'Estado inválido', 'https://jedami.com/errors/invalid-status', 'Solo se puede asignar variante a pedidos pagados o despachados');
    }

    // Verificar que el ítem pertenece al pedido y no tiene variante asignada
    const itemRes = await client.query(
      'SELECT id, size_id, quantity, variant_id FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId],
    );
    const item = itemRes.rows[0];
    if (!item) {
      throw new AppError(404, 'Ítem no encontrado', 'https://jedami.com/errors/not-found', `No existe ítem ${itemId} en el pedido ${orderId}`);
    }
    if (item.variant_id) {
      throw new AppError(409, 'Ítem ya tiene variante', 'https://jedami.com/errors/conflict', 'Este ítem ya tiene una variante asignada');
    }

    if (decrementStock) {
      // Verificar stock y descontar
      const stockRes = await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE variant_id = $2 AND quantity >= $1 RETURNING quantity',
        [item.quantity, variantId],
      );
      if (stockRes.rowCount === 0) {
        throw new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', 'La variante seleccionada no tiene stock suficiente');
      }
    }

    // Asignar variante al ítem
    await client.query('UPDATE order_items SET variant_id = $1 WHERE id = $2', [variantId, itemId]);

    await client.query('COMMIT');
    res.status(200).json({ data: { itemId, variantId, stockDecremented: decrementStock } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function dispatchOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId) || orderId <= 0) {
    next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
    return;
  }

  const orderRes = await pool.query('SELECT id, status FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) {
    next(new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/not-found', `No existe pedido con id ${orderId}`));
    return;
  }
  if (order.status !== 'paid') {
    next(new AppError(422, 'Estado inválido', 'https://jedami.com/errors/invalid-status', 'Solo se pueden despachar pedidos en estado pagado'));
    return;
  }

  const result = await pool.query(
    `UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = $1 RETURNING shipped_at`,
    [orderId],
  );
  res.status(200).json({ data: { orderId, status: 'shipped', shippedAt: result.rows[0].shipped_at } });
}

export async function decrementItemStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orderId = parseInt(req.params.orderId, 10);
  const itemId  = parseInt(req.params.itemId, 10);
  if (isNaN(orderId) || isNaN(itemId)) {
    next(new AppError(400, 'IDs inválidos', 'https://jedami.com/errors/validation', 'orderId e itemId deben ser enteros positivos'));
    return;
  }

  const itemRes = await pool.query(
    'SELECT id, variant_id, quantity FROM order_items WHERE id = $1 AND order_id = $2',
    [itemId, orderId],
  );
  const item = itemRes.rows[0];
  if (!item) {
    next(new AppError(404, 'Ítem no encontrado', 'https://jedami.com/errors/not-found', `No existe ítem ${itemId} en el pedido ${orderId}`));
    return;
  }
  if (!item.variant_id) {
    next(new AppError(422, 'Sin variante asignada', 'https://jedami.com/errors/invalid-status', 'El ítem no tiene variante asignada, asigná el color primero'));
    return;
  }

  const stockRes = await pool.query(
    'UPDATE stock SET quantity = quantity - $1 WHERE variant_id = $2 AND quantity >= $1 RETURNING quantity',
    [item.quantity, item.variant_id],
  );
  if (stockRes.rowCount === 0) {
    next(new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', 'No hay stock suficiente para descontar'));
    return;
  }

  res.status(200).json({ data: { itemId, variantId: item.variant_id, stockRemaining: Number(stockRes.rows[0].quantity) } });
}

export async function getDashboard(_req: Request, res: Response) {
  // Intentar desde caché
  const cached = await cacheGet(DASHBOARD_CACHE_KEY);
  if (cached) {
    return res.status(200).json({ data: JSON.parse(cached) });
  }

  const [statsResult, recentResult] = await Promise.all([
    pool.query(DASHBOARD_QUERY),
    pool.query(RECENT_ORDERS_QUERY),
  ]);

  const row = statsResult.rows[0];

  const data = {
    totalOrders: Number(row.total_orders),
    totalRevenue: Number(row.total_revenue),
    revenueLast30d: Number(row.revenue_last_30d),
    ordersByStatus: {
      pending:  Number(row.pending_orders),
      paid:     Number(row.paid_orders),
      rejected: Number(row.rejected_orders),
    },
    ordersByType: {
      retail:   Number(row.retail_orders),
      curva:    Number(row.curva_orders),
      cantidad: Number(row.cantidad_orders),
    },
    recentOrders: recentResult.rows.map(r => ({
      id:            r.id,
      purchaseType:  r.purchase_type,
      status:        r.status,
      totalAmount:   Number(r.total_amount),
      createdAt:     r.created_at,
      customerEmail: r.customer_email,
    })),
  };

  await cacheSet(DASHBOARD_CACHE_KEY, JSON.stringify(data), DASHBOARD_TTL);

  return res.status(200).json({ data });
}

export async function getAdminPayments(req: Request, res: Response) {
  const page   = Math.max(1, Number(req.query.page)   || 1);
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const status    = (req.query.status    as string) || null;
  const dateFrom  = (req.query.date_from as string) || null;
  const dateTo    = (req.query.date_to   as string) || null;

  const [dataResult, countResult] = await Promise.all([
    pool.query(ADMIN_PAYMENTS_QUERY,       [limit, offset, status, dateFrom, dateTo]),
    pool.query(ADMIN_PAYMENTS_COUNT_QUERY, [status, dateFrom, dateTo]),
  ]);

  const total = Number(countResult.rows[0].total);

  return res.status(200).json({
    data: {
      payments: dataResult.rows.map(r => ({
        id:            r.id,
        orderId:       r.order_id,
        paymentStatus:  r.payment_status,
        paymentMethod:  r.payment_method ?? 'mercadopago',
        amount:         Number(r.amount),
        paidAt:        r.paid_at,
        createdAt:     r.created_at,
        purchaseType:  r.purchase_type,
        orderStatus:   r.order_status,
        totalAmount:   Number(r.total_amount),
        notes:         r.notes ?? null,
        customerEmail: r.customer_email,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

// ─── Confirmar transferencia bancaria ────────────────────────────────────────

export async function confirmBankTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId) || orderId <= 0) {
    next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT id FROM payments
       WHERE order_id = $1 AND payment_method = 'bank_transfer' AND status = 'pending'`,
      [orderId],
    );
    if (paymentRes.rowCount === 0) {
      throw new AppError(404, 'Pago no encontrado', 'https://jedami.com/errors/not-found',
        'No hay pago pendiente de transferencia para este pedido');
    }

    await client.query(
      `UPDATE payments SET status = 'approved', paid_at = NOW() WHERE id = $1`,
      [paymentRes.rows[0].id],
    );
    await client.query(
      `UPDATE orders SET status = 'paid' WHERE id = $1`,
      [orderId],
    );

    await client.query('COMMIT');
    res.status(200).json({ data: { orderId, status: 'paid' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function getAdminUsers(req: Request, res: Response) {
  const page   = Math.max(1, Number(req.query.page)   || 1);
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const role   = (req.query.role   as string) || null;
  const search = (req.query.search as string) || null;

  const [dataResult, countResult] = await Promise.all([
    pool.query(ADMIN_USERS_QUERY,       [limit, offset, role, search]),
    pool.query(ADMIN_USERS_COUNT_QUERY, [role, search]),
  ]);

  const total = Number(countResult.rows[0].total);

  return res.status(200).json({
    data: {
      users: dataResult.rows.map(r => ({
        id:           r.id,
        email:        r.email,
        createdAt:    r.created_at,
        roles:        r.roles ?? [],
        customerId:   r.customer_id   ?? null,
        customerType: r.customer_type ?? null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

// ─── Stock adjustment ─────────────────────────────────────────────────────────

export async function updateVariantStock(req: Request, res: Response): Promise<void> {
  const productId = parseInt(req.params.productId, 10);
  const variantId = parseInt(req.params.variantId, 10);
  const quantity  = parseInt(req.body.quantity,   10);
  const user      = req.user as JwtUserPayload;

  if (isNaN(productId) || isNaN(variantId)) throw new AppError(400, 'IDs inválidos', 'https://jedami.com/errors/validation', 'productId y variantId deben ser enteros positivos');
  if (isNaN(quantity) || quantity < 0)      throw new AppError(400, 'quantity inválido', 'https://jedami.com/errors/validation', 'quantity debe ser un entero >= 0');

  // Verificar que la variante pertenece al producto
  const check = await pool.query(
    'SELECT v.id FROM variants v WHERE v.id = $1 AND v.product_id = $2',
    [variantId, productId],
  );
  if (check.rows.length === 0) throw new AppError(404, 'Variante no encontrada', 'https://jedami.com/errors/not-found', 'La variante no existe en este producto');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      'SELECT quantity FROM stock WHERE variant_id = $1',
      [variantId],
    );
    const oldQuantity: number = oldResult.rows[0]?.quantity ?? 0;

    await client.query(
      'UPDATE stock SET quantity = $1 WHERE variant_id = $2',
      [quantity, variantId],
    );
    await client.query(
      'INSERT INTO stock_adjustments (variant_id, user_id, old_quantity, new_quantity) VALUES ($1, $2, $3, $4)',
      [variantId, user.id, oldQuantity, quantity],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(200).json({ data: { variantId, newQuantity: quantity } });
}
